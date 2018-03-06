# Discourse Paid Pinning Plugin

[![Build Status](https://travis-ci.org/chrisbeach/discourse-paid-pinning.svg?branch=master)](https://travis-ci.org/chrisbeach/discourse-paid-pinning)

Allow forum members to pay to pin a topic

## Installation

See: https://meta.discourse.org/t/install-a-plugin/19157

Repository URL: https://github.com/chrisbeach/discourse-paid-pinning.git

## Stripe Checkout Reference

NOTE: This plugin is not supported or officially endorsed by Stripe (https://stripe.com)

https://stripe.com/docs/checkout/tutorial

## Rails Console

To perform one-off admin operations, use the rails console.

To start the console:

```bash
d/rails c
```

#### Remove all transactions for a user:

```ruby
Txns.remove_all_txns(1)
```

#### Add a transaction to user:

```ruby
Txns.add_txn(User.where(id: 1).first, 1000, 1, 3, nil, "")
```


## Author
Chris Beach <chris @ chrisbeach . co . uk>

## License (Apache 2.0)
