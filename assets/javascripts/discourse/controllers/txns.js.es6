import { default as computed, on } from 'ember-addons/ember-computed-decorators';
import { popupAjaxError } from 'discourse/lib/ajax-error';

export default Ember.Controller.extend({
    newTxn: null,
    saving: false,
    user: null,
    can_delete: null,

    @on('init')
    reset() {
        this.setProperties({ newTxn: null, saving: false, callback: null,  });
    },

    @computed('newTxn', 'saving')
    addDisabled(newTxn, saving) {
        return saving || !newTxn || (newTxn.length === 0);
    },

    actions: {
        addTxn() {
            const txn = this.store.createRecord('pp_txn');
            const userId = parseInt(this.get('userId'));

            this.set('saving', true);

            txn.save({ amount: this.get('amount'), user_id: userId }).then(() => {
                this.set('newTxn', '');
                this.get('model').pushObject(txn);
            }).catch(popupAjaxError).finally(() => this.set('saving', false));
        },

        removeTxn(txn) {
            bootbox.confirm(I18n.t("discourse_paid_pinning.delete_confirm"),
                            I18n.t("no_value"),
                            I18n.t("yes_value"), result => {
                if (result) {
                    txn.destroyRecord().then(() => {
                        this.get('model').removeObject(txn);
                    }).catch(popupAjaxError);
                }
            });
        }
    }
});
