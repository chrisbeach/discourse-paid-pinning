import { showTxns } from 'discourse/plugins/discourse-paid-pinning/discourse-paid-pinning/lib/txns';
import { getOwner } from 'discourse-common/lib/get-owner';

export default {
    shouldRender(args, component) {
        return !args.model.topic &&
            component.currentUser.pp_txn_balance >= component.siteSettings.paid_pinning_plugin_fee;
    }
};
