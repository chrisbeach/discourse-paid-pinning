import computed from 'ember-addons/ember-computed-decorators';

export default Ember.Component.extend({
    tagName: '',

    @computed('count')
    someTxns: count => count && count > 0,

    actions: {
        show() {
            this.sendAction('show');
        }
    }
});
