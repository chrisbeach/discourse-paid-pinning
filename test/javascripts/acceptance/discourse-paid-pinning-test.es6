import { acceptance } from 'helpers/qunit-helpers';
acceptance('Discourse Paid Pinning Plugin', { loggedIn: true });

test('Advertise Link Exists', () => {
    visit('/advertise');

    andThen(() => {
        ok(exists('h1.advertise'), 'Payment page can be loaded');
    });
});
