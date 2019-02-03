export const init(
  MycroftServiceManager,
  MycroftPanelButton,
  MycroftPopup
) => {

  class MycroftUI {
    _init() {

      this.mycroftService = new MycroftServiceManager();

      this.mycroftPanel = new MycroftPanelButton();
      this.myUi = new MycroftPopup();
      this.setEventListeners();

      this.mycroftPanel.menu.addMenuItem(this.myUi.popupMenuMain);


      this.myUi.core_location = this.mycroftPanel.core_location;

      Main.panel.addToStatusArea('mycroftAi', this.mycroftPanel);

      applyStyles();
    }

    setEventListeners() {
      // Service Status Connect
      this.mycroftServiceSettingsChangedId = this.mycroftService.connect('settings-changed', Lang.bind(this.mycroftPanel, function(uploader, status) {
        this.checkPositionInPanel();
      }));

      this.mycroftServiceStatusId = this.mycroftService.connect('mycroft-status', Lang.bind(this, this.updateStatus));

      this.myUiTopMenuBarServiceActorClickId = this.myUi.topMenuBar.serviceActor.connect('clicked', Lang.bind(this.mycroftService, function() {
        this.emit('mycroft-service-clicked');
      }));

      this.mycroftServiceMycroftAnimationStartId = this.mycroftService.connect('mycroft-animation-start', Lang.bind(this.myUi.displayBox.searchBox.barAnimation, this.myUi.displayBox.searchBox.barAnimation.startAnimation));
      this.mycroftServiceMycroftAnimationStopId = this.mycroftService.connect('mycroft-animation-stop', Lang.bind(this.myUi.displayBox.searchBox.barAnimation, this.myUi.displayBox.searchBox.barAnimation.stopAnimation));

      this.myUiDisplayBoxSearchBoxChatBoxSendMessageId = this.myUi.displayBox.searchBox.chatBox.connect('send-message', Lang.bind(this, function(uploader, message) {
        this.mycroftService.emit('send-message', message);
      }));

      this.myUiTopMenuBarHintActorClickedId = this.myUi.topMenuBar.hintActor.connect('clicked', Lang.bind(this.myUi.displayBox, this.myUi.displayBox.showPage));
      this.myUiTopMenuBarSearchActorClickedId = this.myUi.topMenuBar.searchActor.connect('clicked', Lang.bind(this.myUi.displayBox, this.myUi.displayBox.showPage));

      this.mycroftServiceMessageRecievedId = this.mycroftService.connect('message-recieved', Lang.bind(this.myUi.displayBox.searchBox.conversationBox, this.myUi.displayBox.searchBox.conversationBox.addMessage));

      this.myUiTopMenuBarSettingsActorClickedId = this.myUi.topMenuBar.settingsActor.connect('clicked', Lang.bind(this.mycroftPanel, function() {
        this.menu.actor.hide();
        Util.spawn(['gnome-shell-extension-prefs', 'mycroft@rahul.io']);
        return 0;
      }));
    }

    updateStatus(uploader, status) {
      this.myUi.displayBox.searchBox.updateStatus(status);
      status = status == 'remote-error' ? 'failed' : status;
      this.mycroftPanel.updatePanelIcon(status);
      this.myUi.topMenuBar.emit('mycroft-status', status);

    }

    destroy() {
      this.destroySignals();
      this.myUi.destroy();
      this.myUi = null;
      this.mycroftService.destroy();
      this.mycroftService.closeSocket();
      this.mycroftService = null;
      this.mycroftPanel.destroy();
      this.mycroftPanel = null;
    }

    destroySignals() {
      if (this.mycroftServiceSettingsChangedId) {
        this.mycroftService.disconnect(this.mycroftServiceSettingsChangedId);
        this.mycroftServiceSettingsChangedId = 0;
      }
      if (this.mycroftServiceStatusId) {
        this.mycroftService.disconnect(this.mycroftServiceStatusId);
        this.mycroftServiceStatusId = 0;
      }
      if (this.myUiTopMenuBarServiceActorClickId) {
        this.myUi.topMenuBar.serviceActor.disconnect(this.myUiTopMenuBarServiceActorClickId);
        this.myUiTopMenuBarServiceActorClickId = 0;
      }
      if (this.mycroftServiceMycroftAnimationStartId) {
        this.mycroftService.disconnect(this.mycroftServiceMycroftAnimationStartId);
        this.mycroftServiceMycroftAnimationStartId = 0;
      }
      if (this.mycroftServiceMycroftAnimationStopId) {
        this.mycroftService.disconnect(this.mycroftServiceMycroftAnimationStopId);
        this.mycroftServiceMycroftAnimationStopId = 0;
      }
      if (this.myUiDisplayBoxSearchBoxChatBoxSendMessageId) {
        this.myUi.displayBox.searchBox.chatBox.disconnect(this.myUiDisplayBoxSearchBoxChatBoxSendMessageId);
        this.myUiDisplayBoxSearchBoxChatBoxSendMessageId = 0;
      }
      if (this.myUiTopMenuBarHintActorClickedId) {
        this.myUi.topMenuBar.hintActor.disconnect(this.myUiTopMenuBarHintActorClickedId);
        this.myUiTopMenuBarHintActorClickedId = 0;
      }
      if (this.myUiTopMenuBarSearchActorClickedId) {
        this.myUi.topMenuBar.searchActor.disconnect(this.myUiTopMenuBarSearchActorClickedId);
        this.myUiTopMenuBarSearchActorClickedId = 0;
      }
      if (this.mycroftServiceMessageRecievedId) {
        this.mycroftService.disconnect(this.mycroftServiceMessageRecievedId);
        this.mycroftServiceMessageRecievedId = 0;
      }
      if (this.myUiTopMenuBarSettingsActorClickedId) {
        this.myUi.topMenuBar.settingsActor.disconnect(this.myUiTopMenuBarSettingsActorClickedId);
        this.myUiTopMenuBarSettingsActorClickedId = 0;
      }
    }

  }

}
