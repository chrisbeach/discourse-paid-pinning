import { showTxns } from 'discourse/plugins/discourse-paid-pinning/discourse-paid-pinning/lib/txns';
import { getOwner } from 'discourse-common/lib/get-owner';

export default {
    shouldRender(args, component) {
        const { siteSettings, currentUser } = component;
        return siteSettings.paid_pinning_plugin_enabled && currentUser && currentUser.staff;
    },

    setupComponent(args, component) {
        const { model } = args;
        component.set(
            'txnCount',
            model.get('pp_txn_count') || model.get('custom_fields.pp_txn_count') || 0
        );
        component.set(
            'txnBalance',
            model.get('pp_txn_balance') || model.get('custom_fields.pp_txn_balance') || 0
        );
    },

    actions: {
        showTxns() {
            const store = getOwner(this).lookup('store:main');
            const user = this.get('args.model');
            showTxns(store, user.get('id'));
        }
    }
};
