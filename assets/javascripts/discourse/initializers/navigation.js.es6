import { withPluginApi } from 'discourse/lib/plugin-api';

export default {
    name: 'navigation',
    hamburger_footer: [],

    initialize(container) {
        let self = this;
        withPluginApi('0.4', api => {
            api.decorateWidget("hamburger-menu:footerLinks", () => {
                return self.hamburger_footer;
            });
            self.hamburger_footer.push({ href: "/advertise", rawLabel: "Advertise" });
        });
    }
};
