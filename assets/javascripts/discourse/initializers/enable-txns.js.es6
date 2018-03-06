import { withPluginApi } from 'discourse/lib/plugin-api';
import { iconNode } from 'discourse/helpers/fa-icon-node';
import { showTxns } from 'discourse/plugins/discourse-paid-pinning/discourse-paid-pinning/lib/txns';

export default {
    name: 'enable-txns',
    initialize(container) {
        const siteSettings = container.lookup('site-settings:main');
        const currentUser = container.lookup('current-user:main');
        if (!siteSettings.paid_pinning_plugin_enabled || !currentUser || !currentUser.staff) { return; }

        const store = container.lookup('store:main');
        withPluginApi('0.8.7', api => {


            // FIXME what is this doing?
            function widgetShowTxns() {
                showTxns(store, this.attrs.user_id, count => {
                    this.sendWidgetAction('refreshTxns', count);
                });
            }

            // FIXME what is this doing?
            api.attachWidgetAction('post', 'refreshTxns', function(count) {
                const cfs = this.model.get('user_custom_fields') || {};
                // FIXME recalc balance too!
                cfs.pp_txn_count = count;
                cfs.pp_txn_balance = count;
                this.model.set('user_custom_fields', cfs);
            });

            const UserController = container.lookupFactory('controller:user');
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
                click: widgetShowTxns,

                html() {
                    if (siteSettings.enable_emoji) {
                        return this.attach('emoji', { name: 'credit_card' });
                    } else {
                        return iconNode('credit-card');
                    }
                }
            });

            api.modifyClass('model:composer', {
                createPost(opts) {
                    const result = this._super(opts);
                    if (result) {
                        result.then(r => {
                            if (r.payload && typeof(r.payload.pp_txn_balance) !== 'undefined') {
                                Discourse.User.current().set("pp_txn_balance", r.payload.pp_txn_balance);
                            }
                        });
                    }
                    return result;
                }
            });
        });
    },
};
