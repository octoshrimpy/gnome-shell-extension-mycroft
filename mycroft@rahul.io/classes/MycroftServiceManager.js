export const init(
  {PopupBaseMenuItem}
) => {


  class MycroftServiceManager extends PopupBaseMenuItem {

    _init_() {
      this.wsStarted = false;
      this.loadConfig();
      position_in_panel = this._position_in_panel;
      core_location = this.core_location;
      mycroft_is_install = this.mycroft_is_install;
      install_type = this.install_type;
      animation_status = this.animation_status;
      this.setEventListeners();
      if (mycroft_is_install) {
        this.emitServiceStatus('install');
      }
      _timeoutId = Mainloop.timeout_add(2000, Lang.bind(this, function() {
        this.getServiceStatus(Lang.bind(this, function(status) {
          if (status === 'active') {
            this.emitServiceStatus('starting');
            if (_timeoutId !== 0) {
              Mainloop.source_remove(_timeoutId);
            }
            _timeoutId = Mainloop.timeout_add(1000, Lang.bind(this, function() {
              this.initWS();
              _timeoutId = 0;
            }));
          } else if (status === 'disabled' || status === 'failed') {
            this.emitServiceStatus('disabled');
          } else if (status === 'install') {
            // do nothing
          } else if (status === 'remote') {
            this.emitServiceStatus('starting');
            _timeoutId = Mainloop.timeout_add(6000, Lang.bind(this, function() {
              this.initWS();
              _timeoutId = 0;
            }));
          }
        }));
        _timeoutId = 0;
      }));
    }

    setEventListeners() {
      this.serviceClicked = this.connect('mycroft-service-clicked', Lang.bind(this, function() {
        if (!this.locked) {
          this.locked = true;
          this.getServiceStatus(Lang.bind(this, function(status) {
            if (status === 'active' || status === 'listening') {
              this.stopService();
            } else if (status === 'disabled' || status === 'failed') {
              this.startService();
            } else if (status === 'install') {
              // do nothing;
            } else if (status === 'remote') {
              if (!this.wsStarted) {
                this.emitServiceStatus('starting');
                _timeoutId = Mainloop.timeout_add(8000, Lang.bind(this, function() {
                  this.initWS();
                  _timeoutId = 0;
                }));
              } else {
                this.emitServiceStatus('disabled');
                this.closeSocket();
              }
            }
          }));
        } else {
          //locked
        }
      }));
      this.sendMessageId = this.connect('send-message', Lang.bind(this, function(uploader, message) {
        this.sendMessage(message);
      }));
    }

    startService() {
      if (_timeoutId !== 0) {
        Mainloop.source_remove(_timeoutId);
      }
      this.getServiceStatus(Lang.bind(this, function(status) {
        if (status === 'disabled' || status === 'failed') {
          try {
            GLib.spawn_command_line_async(core_location + '/start-mycroft.sh all');
            this.emitServiceStatus('starting');
            _timeoutId = Mainloop.timeout_add(5000, Lang.bind(this, function() {
              this.getServiceStatus(Lang.bind(this, function(status) {
                if (status === 'active') {
                  _timeoutId = Mainloop.timeout_add(5000, Lang.bind(this, function() {
                    this.initWS();
                  }));
                }
              }));
              _timeoutId = 0;
            }));
          } catch (e) {
            log('Mycroft UI - Start Service' + e);
          }
        }
      }));
    }

    stopService(callback) {
      this.emitServiceStatus('stopping');
      try {
        GLib.spawn_command_line_async(core_location + '/stop-mycroft.sh');
        this.closeSocket();
        this.wsStarted = false;
      } catch (e) {
        log('Mycroft UI - Stop Service' + e);
      }
      this.emitServiceStatus('disabled');
    }

    getServiceStatus(callback) {
      let e, outStr;
      if (mycroft_is_install && install_type != 2) {
        try {
          // let [res, out] = GLib.spawn_command_line_sync(EXTENSIONDIR + '/shellscripts/serviceStatus.sh');
          let [res, out] = GLib.spawn_command_line_sync('screen -ls');
          if (out.length > 1) {
            outStr = out.toString();
            if (outStr.indexOf('mycroft-service') > 1 && outStr.indexOf('mycroft-voice') > 1 && outStr.indexOf('mycroft-skills') > 1) {
              if (this.wsStarted) {
                this.emitServiceStatus('active');
              } else {
                this.emitServiceStatus('starting');
              }
              callback('active');
            } else {
              callback('disabled');
            }
          } else {
            callback('disabled');
          }
        } catch (err) {
          log('Mycroft UI - Get Service Status' + err);
        }
      } else if (install_type == 2) {
        callback('remote');
      } else {
        this.emitServiceStatus('install');
        callback('install');
      }
    }

    initWS() {
      this.user_agent = Me.metadata.uuid;
      if (Me.metadata.version !== undefined && Me.metadata.version.toString().trim() !== '') {
        this.user_agent += '/';
        this.user_agent += Me.metadata.version.toString();
      }
      this.user_agent += ' ';
      if (!this.wsStarted && mycroft_is_install) {
        // if (socketClient === undefined) {
        // 	socketClient = new Soup.Session();
        // 	socketClient.user_agent = this.user_agent;
        // } else {
        // 	// abort previous requests.
        // 	socketClient.abort();
        // 	socketClient = new Soup.Session();
        // }
        // let proxy = new Soup.ProxyResolverDefault();
        // Soup.Session.prototype.add_feature.call(socketClient, proxy);

        socketClient.httpsAliases = ['wss'];
        let message = new Soup.Message({
          method: 'GET',
          uri: new Soup.URI('ws://' + this.ip_address + ':' + this.port_number + '/core'),
        });
        try {
          socketClient.websocket_connect_async(message, null, null, null, Lang.bind(this, function(session, result) {
            try {

              this.connection = session.websocket_connect_finish(result);
              if (this.connection !== null) {
                this.connection.connect('message', Lang.bind(this, this.onMessage));

                this.connection.connect('closed', Lang.bind(this, function(connection) {
                  this.onClosed(connection);
                }));

                this.wsStarted = true;
              }
            } catch (e) {
              if (this.install_type == 2) {
                this.emitServiceStatus('remote-error');
              }
              this.emitServiceStatus('failed');
            }
          }));
        } catch (e) {
          log('Mycroft UI - Init Websocket' + e);
        }
      }
      this.locked = false;
    }

    onMessage(connection, type, message) {
      //TODO: turn the code below into switch case
      let data = JSON.parse(message.get_data());

      if (data.type === 'connected') {
        this.emitServiceStatus('active'); // Active();
      } else if (data.type === 'speak') {
        this.emit('message-recieved', data.data.utterance, 'mycroft');
      } else if (data.type === 'mycroft.not.paired') {
        //
      } else if (data.type === 'recognizer_loop:audio_output_start') {
        this.emitAnimationStatus('audio_output_start');
      } else if (data.type === 'recognizer_loop:audio_output_end') {
        this.emitAnimationStatus('audio_output_stop');
      } else if (data.type === 'enclosure.weather.display') {
        //log('show Weather Panel');
      } else if (data.type === 'configuration.updated') {
        this.wsStarted = true;
      } else if (data.type === 'recognizer_loop:record_begin') {
        this.emitServiceStatus('listening');
      } else if (data.type === 'recognizer_loop:record_end') {
        this.emitServiceStatus('active');
      } else if (data.type === 'configuration.updated') {
        // later
      } else if (data.type === 'recognizer_loop:utterance') {
        this.emit('message-recieved', data.data.utterances[0], 'me');
      } else if (data.type === 'intent_failure') {
        // this.emit('message-recieved', 'Sorry I didn\'t understand you. Please rephrase or ask another question','mycroft');
      }
    }

    onClosing() {

    }

    onClosed(connection) {
      this.wsStarted = false;
      // connection.close(Soup.WebsocketCloseCode.NORMAL, "");
      if (_timeoutId !== 0) {
        Mainloop.source_remove(_timeoutId);
      }

      _timeoutId = Mainloop.timeout_add(6000, Lang.bind(this, function() {
        this.getServiceStatus(Lang.bind(this, function(status) {
          if (status === 'active') {
            _timeoutId = Mainloop.timeout_add(4000, Lang.bind(this, function() {
              this.initWS();
            }));
          } else if (status === 'disabled' || status === 'remote') {
            if (socketClient !== undefined) {
              socketClient.abort();
            }
          }
        }));
        _timeoutId = 0;
      }));

      // socketClient.abort();
    }

    onError(connection, error) {
      log('Mycroft UI - Connection Error : ' + error);
    }

    sendMessage(val) {
      if (this.wsStarted) {
        let socketmessage = {};
        socketmessage.type = 'recognizer_loop:utterance';
        socketmessage.data = {};
        socketmessage.data.utterances = [val];
        try {
          this.connection.send_text(JSON.stringify(socketmessage));
        } catch (e) {
          log('Mycroft UI - Send Message: ' + e);
        }
      } else {
        log('Mycroft UI - No web socket');
      }
    }

    closeSocket() {
      try {
        if (this.connection) {
          this.connection.close(Soup.WebsocketCloseCode.NORMAL, '');
        }
        if (socketClient) {
          socketClient.abort();
        }
      } catch (e) {
        log('Mycroft UI - Close Socket: ' + e);
      }
    }

    emitServiceStatus(status, arg) {

      if (status === 'starting' || status === 'stopping') {
        this.locked = true;
      } else {
        this.locked = false;
      }
      this.emitAnimationStatus(status);
      this.emit('mycroft-status', status);
    }

    emitAnimationStatus(status) {
      if (status === 'audio_output_start') {
        this.emit('mycroft-animation-start', 'active');
      } else if (status === 'audio_output_stop') {
        this.emit('mycroft-animation-stop', 'active');
      } else if (status === 'starting' || status === 'stopping' || status === 'listening') {
        this.emit('mycroft-animation-start', status);
      } else {
        this.emit('mycroft-animation-stop', status);
      }
    }

    destroy() {
      if (this._settingsC) {
        this._settings.disconnect(this._settingsC);
        this._settingsC = undefined;
      }
      if (this.serviceClicked) {
        this.disconnect(this.serviceClicked);
        this.serviceClicked = 0;
      }
      if (this.sendMessageId) {
        this.disconnect(this.sendMessageId);
        this.sendMessageId = 0;
      }
    }

    loadConfig() {
      this._settings = Convenience.getSettings(MYCROFT_SETTINGS_SCHEMA);
      mycroft_is_install = this.mycroft_is_install;
      install_type = this.mycroft_install_type;
      if (this._settingsC) {
        this._settings.disconnect(this._settingsC);
      }
      this._settingsC = this._settings.connect('changed', Lang.bind(this, function() {
        position_in_panel = this._position_in_panel;
        core_location = this.core_location;
        animation_status = this.animation_status;
        let mycroft_is_install_change = this.mycroft_is_install;
        let install_type_change = this.install_type;
        this.emit('settings-changed');
        if (mycroft_is_install !== mycroft_is_install_change) {
          mycroft_is_install = this.mycroft_is_install;
          this.emitServiceStatus('disabled');
        } else if (mycroft_is_install_change === false) {
          if (this.wsStarted) {
            this.stopService();
          }
          this.emitServiceStatus('install');
        }
        if (install_type !== install_type_change) {
          install_type = this.install_type;
          if (install_type == 2) {
            this.emitServiceStatus('disabled');
            if (this.wsStarted) {
              this.closeSocket();
            }
          }
        }
      }));
    }

    get mycroft_is_install() {
      if (!this._settings) {
        this.loadConfig();
      }
      return this._settings.get_boolean(MYCROFT_IS_INSTALL_KEY);
    }

    get _position_in_panel() {
      if (!this._settings) {
        this.loadConfig();
      }
      return this._settings.get_enum(MYCROFT_POSITION_IN_PANEL_KEY);
    }

    get core_location() {
      if (!this._settings) {
        this.loadConfig();
      }
      return this._settings.get_string(MYCROFT_CORE_LOCATION_KEY);
    }

    get install_type() {
      if (!this._settings) {
        this.loadConfig();
      }
      return this._settings.get_int(MYCROFT_INSTALL_TYPE_KEY);
    }

    get animation_status() {
      if (!this._settings) {
        this.loadConfig();
      }
      return this._settings.get_boolean(MYCROFT_ANIMATION_STATUS_KEY);
    }

    get ip_address() {
      if (!this._settings) {
        this.loadConfig();
      }
      return this._settings.get_string(MYCROFT_IP_ADDRESS_KEY);
    }

    get port_number() {
      if (!this._settings) {
        this.loadConfig();
      }
      return this._settings.get_string(MYCROFT_PORT_NUMBER_KEY);
    }
  }

}
