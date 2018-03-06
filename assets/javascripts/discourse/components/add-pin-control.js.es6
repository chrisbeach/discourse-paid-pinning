import { getRegister } from 'discourse-common/lib/get-owner';

export default Ember.Component.extend({
    classNames: ['pin-controls'],
    model: null,

    init() {
        this._super();
        this.model.set("is_pinned", true);
    },

    // Shuffle the controls from underneath the title to up next to "Create a new topic"
    didInsertElement() {
        const $controls = this.$();
        $controls.detach();
        $controls.insertAfter($('#reply-control .reply-area .composer-fields .reply-to .reply-details .composer-action-title'));
    }
});
