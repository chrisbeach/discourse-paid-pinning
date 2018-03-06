require 'rails_helper'
require_relative '../../support/dd_helper'

# shared_examples 'failure response' do |message_key|
#   let(:body) { JSON.parse(response.body) }
#
#   it 'has status 200' do expect(response).to have_http_status(200) end
#   it 'has an error message' do expect(body['messages']).to include(I18n.t(message_key)) end
#   it 'is not successful' do expect(body['success']).to eq false end
#   it 'does not create a payment' do DiscourseStripe::Stripe.expects(:new).never end
# end

module DiscourseStripe
  RSpec.describe CheckoutController, type: :controller do
    routes { DiscourseStripe::Engine.routes }
    let(:body) { JSON.parse(response.body) }

    before do
      SiteSetting.stubs(:disable_discourse_narrative_bot_welcome_post).returns(true)
      SiteSetting.stubs(:paid_pinning_plugin_secret_key).returns('secret-key-yo')
      SiteSetting.stubs(:paid_pinning_plugin_description).returns('charity begins at discourse plugin')
      SiteSetting.stubs(:paid_pinning_plugin_currency).returns('USD')
    end

    # let(:allowed_params) { {stripeEmail: 'email@example.com', amount: 100, stripeToken: 'rrurrrurrrrr'} }
    #
    # it 'whitelists the params' do
    #   should permit(
    #                 :amount,
    #                 :stripeToken,
    #                 :stripeEmail).
    #       for(:create, params: { params: allowed_params })
    # end

    it 'responds ok for anonymous users' do
      post :create, params: { stripeEmail: 'foobar@example.com', amount: 100, stripeToken: 'rrurrrurrrrr' }
      expect(body['messages']).to include(I18n.t('discourse_paid_pinning.payments.success'))
      expect(response).to have_http_status(200)
    end
  end
end
