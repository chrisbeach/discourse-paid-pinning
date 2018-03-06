module ::DiscourseStripe
  class Engine < ::Rails::Engine
    engine_name 'discourse-paid-pinning'
    isolate_namespace DiscourseStripe
  end
end