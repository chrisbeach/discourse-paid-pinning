require_dependency 'discourse'

module DiscourseStripe
  require_dependency 'user'

  class CheckoutController < ApplicationController

    skip_before_action :verify_authenticity_token, only: [:create]

    def create
      Rails.logger.info "Checkout for #{current_user.username}"

      Rails.logger.debug user_params.inspect

      user_params[:stripeEmail]

      output = { 'messages' => [], balance: ::Txns.balance_of(current_user) }
      payment = DiscourseStripe::Stripe.new(secret_key, stripe_options)

      begin
        charge = payment.checkoutCharge(user_params[:stripeEmail],
                                        user_params[:stripeToken],
                                        user_params[:amount])
      rescue ::Stripe::CardError => e
        err = e.json_body[:error]

        output['messages'] << "There was an error (#{err[:type]}) for #{current_user.username}."
        output['messages'] << "Error code: #{err[:code]} for #{current_user.username}" if err[:code]
        output['messages'] << "Decline code: #{err[:decline_code]} for #{current_user.username}" if err[:decline_code]
        output['messages'] << "Message: #{err[:message]} for #{current_user.username}" if err[:message]

        Rails.logger.error output['messages']

        render(:json => output) and return
      end

      if charge['paid']
        Rails.logger.debug charge.inspect

        txn = ::Txns.add_txn(current_user, charge.amount, current_user.id, Txns.types[:card])
        Rails.logger.info "Successful payment. Added #{txn} for #{current_user.username}"

        grants_trust_level = SiteSetting.paid_pinning_plugin_grants_trust_level

        if (current_user.group_locked_trust_level || 0) < grants_trust_level
          Rails.logger.info "Promoting user #{current_user.username} to trust level #{grants_trust_level}"
          current_user.update!(group_locked_trust_level: grants_trust_level)
          current_user.reload
          TrustLevelGranter.grant(grants_trust_level, current_user)
        end

        output['messages'] << I18n.l(Time.now(), format: :long) + ': ' + I18n.t('discourse_paid_pinning.payments.success')
        output['balance'] = ::Txns.balance_of(current_user)
        output['txn'] = txn
      end

      render :json => output
    end

    private


    def secret_key
      SiteSetting.paid_pinning_plugin_secret_key
    end

    def user_params
      params.require(:stripeToken)
      params.permit(:format,
                    :amount,
                    :email,
                    :stripeToken,
                    :stripeTokenType,
                    :stripeEmail,
                    :stripeBillingName,
                    :stripeBillingAddressLine1,
                    :stripeBillingAddressZip,
                    :stripeBillingAddressState,
                    :stripeBillingAddressCity,
                    :stripeBillingAddressCountry,
                    :stripeBillingAddressCountryCode,
                    :stripeShippingName,
                    :stripeShippingAddressLine1,
                    :stripeShippingAddressZip,
                    :stripeShippingAddressState,
                    :stripeShippingAddressCity,
                    :stripeShippingAddressCountry,
                    :stripeShippingAddressCountryCode

      )
    end

    def stripe_options
      {
          description: SiteSetting.paid_pinning_plugin_description,
          currency: SiteSetting.paid_pinning_plugin_currency
      }
    end
  end
end
