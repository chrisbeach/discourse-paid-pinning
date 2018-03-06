import { htmlHelper } from 'discourse-common/lib/helpers';
import { iconHTML } from 'discourse-common/lib/icon-library';

const TEXT_KEY = {
    1: 'card',
    2: 'pinned_topic',
    3: 'manual',
};

const ICON = {
    1: 'credit-card',
    2: 'thumb-tack',
    3: 'user-circle',
};

export default htmlHelper(value => {
    if (value < 1 || value > 3) {
        return "";
    } else {
        const text = I18n.t('discourse_paid_pinning.txns.type.' + TEXT_KEY[value]);
        const icon = iconHTML(ICON[value]);
        return `${icon} ${text}`;
    }
});
