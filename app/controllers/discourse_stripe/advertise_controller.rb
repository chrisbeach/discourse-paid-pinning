require_dependency 'discourse'

module DiscourseStripe
  class AdvertiseController < ApplicationController

    requires_plugin 'discourse-plugin-stripe'

    def index
    end
  end
end
