module DiscourseStripe
  class Stripe
    attr_reader :charge, :currency, :description

    def initialize(secret_key, opts)
      ::Stripe.api_key = secret_key
      @description = opts[:description]
      @currency = opts[:currency]
    end

    def checkout_charge(user = nil, email, token, amount)
      customer = customer(user, email, token)

      @charge = ::Stripe::Charge.create(
        :customer => customer.id,
        :amount => amount,
        :description => @description,
        :currency => @currency
      )
      @charge
    end

    def subscribe(user = nil, email, opts)
      customer = customer(user, email, opts[:stripeToken])
      @subscription = ::Stripe::Subscription.create(
        customer: customer.id,
        plan: opts[:plan]
      )
      @subscription
    end

    def customer(user, email, source)
      if user.stripe_customer_id
        ::Stripe::Customer.update(user.stripe_customer_id, source: source)
        ::Stripe::Customer.retrieve(user.stripe_customer_id)
      else
        customer = ::Stripe::Customer.create(
            email: email,
            source: source,
            metadata: {
                username: user.username
            }
        )
        user.custom_fields['stripe_customer_id'] = customer.id
        user.save_custom_fields(true)
        customer
      end
    end

    def successful?
      @charge[:paid]
    end
  end
end
