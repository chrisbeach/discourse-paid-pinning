import { getRegister } from 'discourse-common/lib/get-owner';
import computed from 'ember-addons/ember-computed-decorators';

export default Ember.Component.extend({
    amount: 0,
    ccySymbol: '',
    tagName: '',

    @computed('amount')
    displayAmount: amount => parseFloat(amount / 100, 10).toFixed(2),

    init() {
        const ccySymbols = new Map([
            ['aud', '&dollar;'],
            ['cad', '&dollar;'],
            ['eur', '&euro;'],
            ['gbp', '&pound;'],
            ['jpy', '&yen;'],
            ['rub', '&#x20bd;'],
            ['usd', '&dollar;']
        ]);
        this._super();
        this.set('ccySymbol', ccySymbols.get(getRegister(this).lookup('site-settings:main').paid_pinning_plugin_currency.toLowerCase()));
    }
});
