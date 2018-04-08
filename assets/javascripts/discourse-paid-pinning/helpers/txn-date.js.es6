import { htmlHelper } from 'discourse-common/lib/helpers';
import { iconHTML } from 'discourse-common/lib/icon-library';

export default htmlHelper(value => {
    return moment(Date.parse(value)).format('lll');
});
