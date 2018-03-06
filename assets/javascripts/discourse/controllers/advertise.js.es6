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
                self.set('txns', model);
            });
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
