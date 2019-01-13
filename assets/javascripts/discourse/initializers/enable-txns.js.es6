import { withPluginApi } from 'discourse/lib/plugin-api';
import { iconNode } from 'discourse/helpers/fa-icon-node';
import { showTxns } from 'discourse/plugins/discourse-paid-pinning/discourse-paid-pinning/lib/txns';

export default {
    name: 'enable-txns',
    initialize(container) {
        const siteSettings = container.lookup('site-settings:main');
        const currentUser = container.lookup('current-user:main');
        if (!siteSettings.paid_pinning_plugin_enabled || !currentUser) { return; }

        function enableStaffFeatures(api) {
            const store = container.lookup('store:main');

            const UserController = container.factoryFor('controller:user');
            UserController.reopen({
                txnCount: null,

                _modelChanged: function() {
                    this.set('txnCount', this.get('model.custom_fields.pp_txn_count') || 0);
                    this.set('txnBalance', this.get('model.custom_fields.pp_txn_balance') || 0);
                }.observes('model').on('init'),

                actions: {
                    showTxns() {
                        const user = this.get('model');
                        showTxns(store, user.get('id'), count => this.set('txnCount', count));
                    }
                }
            });

            const mobileView = api.container.lookup('site:main').mobileView;
            const loc = mobileView ? 'before' : 'after';
            api.decorateWidget(`poster-name:${loc}`, dec => {
                const cfs = dec.attrs.userCustomFields || {};
                if (cfs.pp_txn_count && cfs.pp_txn_count > 0) {
                    return dec.attach('txns-icon');
                }
            });

            // Shown (by the above code) next to users that have txns
            api.createWidget('txns-icon', {
                tagName: 'span.txns-icon',
                click: function() {
                    showTxns(store, this.attrs.user_id);
                },

                html() {
                    if (siteSettings.enable_emoji) {
                        return this.attach('emoji', { name: 'credit_card' });
                    } else {
                        return iconNode('credit-card');
                    }
                }
            });
        }


        withPluginApi('0.8.7', api => {

            const messageBus = container.lookup('message-bus:main');
            if (messageBus) {
                const channel = "/user/" +  currentUser.id + "/pp_fields";
                messageBus.subscribe(channel, message => {
                    console.log("Got paid_pinning user fields update: ");
                    console.log(message);
                    if (message.fields && message.fields.pp_user_fields) {
                        currentUser.set("pp_txn_balance", message.fields.pp_user_fields.txn_balance);
                        currentUser.set("pp_txn_count", message.fields.pp_user_fields.txn_count);
                    }
                });
                console.log("Subscribed to pp_fields updates on " + channel);
            } else {
                console.warn("No message bus found")
            }
            

            if (currentUser.staff) {
                enableStaffFeatures(api)
            }
        });
    },
};
