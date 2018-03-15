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
        console.log("Initialising advertise controller");
        this._super();

        let self = this;
        // Return here after creating an account
        $.cookie('destination_url', window.location.href);
        this.set('anon', !Discourse.User.current());
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
        if (Discourse.User.current()) {
            store.find('pp_txn', { user_id: Discourse.User.current().id }).then(model => {
                console.log("Loaded from store:");
                console.log(model);
                self.set('txns', model);
            });
            const messageBus = getRegister(this).lookup('message-bus:main');
            if (messageBus) {
                messageBus.subscribe("/user/" +  Discourse.User.current().id + "/new_pp_txn", message => {
                    console.log("Got message bus update: ");
                    console.log(message);
                    if (message.txn && message.txn.pp_txn) {
                        // A horrible hack until we can get properly serialised json from server-side
                        message.txn.pp_txn.created_by = Discourse.User.current();
                        self.get("txns").pushObject(message.txn.pp_txn);
                        const oldBalance = Discourse.User.current().get("pp_txn_balance") || 0;
                        Discourse.User.current().set("pp_txn_balance", oldBalance + message.txn.pp_txn.amount);
                    }
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
