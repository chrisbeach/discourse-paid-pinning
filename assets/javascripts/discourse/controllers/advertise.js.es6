import { cookAsync } from 'discourse/lib/text';
import { getRegister } from 'discourse-common/lib/get-owner';
import { ajax } from 'discourse/lib/ajax';
import computed from 'ember-addons/ember-computed-decorators';
import Composer from 'discourse/models/composer';
import { getOwner } from 'discourse-common/lib/get-owner';



export default Ember.Controller.extend({
    composer: Ember.inject.controller(),
    loading: true,
    anon: null,
    settings: null,
    txns: null,
    action: "createTopic",

    init() {
        this._super();
        let self = this;
        const currentUser = Discourse.User.current();
        // Return here after creating an account
        $.cookie('destination_url', window.location.href);
        this.set('anon', !currentUser);
        this.set('settings', getRegister(this).lookup('site-settings:main'));
        this.set('cooked_spiel', '');
        cookAsync(I18n.t('discourse_paid_pinning.advertise_spiel')).then(
            cooked => {
                self.set('cooked_spiel', cooked);
                // no choice but to defer this cause
                // pretty text may only be loaded now
                Em.run.next(() =>
                    window.requireModule('pretty-text/image-short-url').resolveAllShortUrls(ajax)
                );
                self.set('loading', false);
            }
        );
        const store = getOwner(this).lookup('store:main');
        if (currentUser) {
            store.find('pp_txn', { user_id: currentUser.id }).then(model => {
                self.set('txns', model);
            });
            const messageBus = getRegister(this).lookup('message-bus:main');
            if (messageBus) {
                messageBus.subscribe("/user/" +  currentUser.id + "/new_pp_txn", message => {
                    console.debug("Got new txn update: ");
                    console.debug(message);
                    // Creating a new topic causes the client-side message bus to receive duplicate messages, so check we haven't received this txn before
                    if (message.txn && message.txn.pp_txn && !self.get("txns").find(t => t.id === message.txn.pp_txn.id)) {
                        // A horrible hack until we can get properly serialised json from server-side
                        message.txn.pp_txn.created_by = currentUser;
                        self.get("txns").pushObject(message.txn.pp_txn);
                    }
                });
                messageBus.subscribe("/user/" +  currentUser.id + "/del_all_pp_txns", message => {
                    self.set("txns", []);
                });
            }
        }

    },

    @computed('anon', 'currentUser.pp_txn_balance')
    cannotCreateTopic(anon, balance) {
        return anon === true || this.get('settings').paid_pinning_plugin_fee > balance;
    },

    @computed('anon', 'currentUser.pp_txn_balance')
    cannotPay(anon, balance) {
        return anon === true || balance >= this.get('settings').paid_pinning_plugin_fee;
    },

    actions: {
        createTopic: function createTopic()  {
            const composerController = this.get('composer');

            const opts = {
                action: Composer.CREATE_TOPIC,
                draftKey: Composer.CREATE_TOPIC
            };

            composerController.open(opts);
        },
    }
});
