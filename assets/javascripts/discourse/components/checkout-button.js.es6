import { getRegister } from 'discourse-common/lib/get-owner';
import { ajax } from 'discourse/lib/ajax';
import computed from 'ember-addons/ember-computed-decorators';

export default Ember.Component.extend({
    checkoutOpen: false,
    transactionInProgress: false,
    failure: null,
    result: [],
    amount: null,
    anon: null,
    tagName: '',

    init() {
        this._super();
        const currentUser = Discourse.User.current();
        this.set('anon', !currentUser);
        this.set('settings', getRegister(this).lookup('site-settings:main'));
        this.amount = this.get('settings').paid_pinning_plugin_fee;

        let self = this;

        if (typeof StripeCheckout === 'undefined') {
            self.set('failure', I18n.t('discourse_paid_pinning.failed_stripe_load'));
        } else if (currentUser) {
            // Need to do this in order to get the email. Not ideal for performance:
            Discourse.User.findByUsername(currentUser.username).then((user) => {
                this.set('stripeHandler', StripeCheckout.configure({
                    key: self.get('settings').paid_pinning_plugin_public_key,
                    image: self.get('settings').paid_pinning_plugin_shop_image || self.get('settings').logo_small_url,
                    locale: 'auto',
                    email: user.email,
                    billingAddress: self.get('settings').paid_pinning_plugin_billing_address,
                    zipCode: self.get('settings').paid_pinning_plugin_zip_code,
                    token: function (token) {
                      self.set('transactionInProgress', true);
                      console.debug("Stripe callback");
                      console.debug(token);
                      let params = {
                        stripeToken: token.id,
                        email: token.email,
                        amount: self.get('amount'),
                      };
                      ajax('/checkout.json', {data: params, method: 'post'}).then(data => {
                        console.debug("Server reports successful payment.");
                        self.set('result', data.messages);
                        self.set('transactionInProgress', false);
                      }).catch((e) => {
                        self.set('transactionInProgress', false);
                        alert(e);
                      });
                    },
                    closed: function () {
                      self.set('checkoutOpen', false);
                    }
                }));
            });
        }
    },

    @computed('checkoutOpen', 'transactionInProgress', 'anon', 'failure')
    disabledPayButton(checkoutOpen, transactionInProgress, anon, failure) {
        return failure || checkoutOpen === true || transactionInProgress === true || anon === true;
    },

    @computed('currentUser.pp_txn_balance')
    classes(balance) {
        return "btn btn-pp-payment " + (balance && balance > 0 ? 'btn-default' : 'btn-primary');
    },

    actions: {
        submitStripeCheckout() {
            let self = this;
            self.set('checkoutOpen', true);
            self.get('stripeHandler').open({
                name: self.get('settings').paid_pinning_plugin_shop_name,
                description: self.get('settings').paid_pinning_plugin_description,
                currency: self.get('settings').paid_pinning_plugin_currency,
                amount: self.get('amount'),
                allowRememberMe: true
            });
        }
    }
});


