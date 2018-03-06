DiscourseStripe::Engine.routes.draw do
  resources :checkout, only: [:create]
  get 'advertise' => 'advertise#index'
end
