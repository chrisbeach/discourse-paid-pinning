import showModal from 'discourse/lib/show-modal';
import loadScript from 'discourse/lib/load-script';

export function showTxns(store, userId) {
    loadScript('defer/html-sanitizer-bundle').then(() => {
        return store.find('pp_txn', {user_id: userId}).then(model => {
            const controller = showModal('txns', {
                model,
                title: 'discourse_paid_pinning.txns.title',
                addModalBodyView: true
            });
            controller.reset();
            controller.set('userId', userId);
            console.log("Showing txns for " + userId);
            return controller;
        });
    });
}