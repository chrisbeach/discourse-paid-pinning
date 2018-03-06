import Composer from 'discourse/models/composer';
import { observes, on } from 'ember-addons/ember-computed-decorators';
import { withPluginApi } from 'discourse/lib/plugin-api';

export default {
    name: 'is_pinned_edits',
    initialize(container) {
        Composer.serializeOnCreate('is_pinned');
        Composer.serializeToTopic('is_pinned', 'topic.is_pinned');
    }
}