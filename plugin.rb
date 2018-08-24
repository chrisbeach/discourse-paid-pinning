# name: discourse-paid-pinning
# about: Allows payment for pinned topics
# version: 0.9
# authors: Chris Beach
# url: https://github.com/chrisbeach/discourse-paid-pinning.git

gem 'stripe', '2.8.0'

load File.expand_path('../lib/discourse_paid_pinning/engine.rb', __FILE__)

enabled_site_setting :paid_pinning_plugin_enabled

register_asset 'stylesheets/discourse-paid-pinning.scss'

register_html_builder('server:before-head-close') do
  "<script src='https://checkout.stripe.com/checkout.js'></script>"
end

after_initialize do

  TXN_BALANCE_FIELD = 'pp_txn_balance'
  TXN_COUNT_FIELD = 'pp_txn_count'
  STRIPE_CUSTOMER_ID_FIELD = 'stripe_customer_id'

  # FIXME do we need both?
  Topic.register_custom_field_type('is_pinned', :boolean)
  Topic.register_custom_field_type(TXN_BALANCE_FIELD, :int)
  Topic.register_custom_field_type(TXN_COUNT_FIELD, :int)
  Post.register_custom_field_type('is_pinned', :boolean)
  Post.register_custom_field_type(TXN_BALANCE_FIELD, :int)
  Post.register_custom_field_type(TXN_COUNT_FIELD, :int)

  require_dependency 'topic'
  require_dependency 'discourse'

  # FIXME - is_pinned on a new topic should be true if user has sufficient balance
  class ::Topic
    def is_pinned?
      if self.custom_fields['is_pinned'].present?
        self.custom_fields['is_pinned']
      else
        Txns.balance_of(self.user) >= SiteSetting.paid_pinning_plugin_fee
      end
    end
  end

  require_dependency 'topic_view_serializer'
  class ::TopicViewSerializer
    def is_pinned
      object.topic.is_pinned
    end
  end

  # FIXME do we need this?
  PostRevisor.track_topic_field(:is_pinned)

  # FIXME do we need this?
  PostRevisor.class_eval do
    track_topic_field(:is_pinned) do |tc, pinned_value|
      tc.record_change('is_pinned', tc.topic.custom_fields['is_pinned'], pinned_value)
      tc.topic.custom_fields['is_pinned'] = pinned_value
    end
  end

  DiscourseEvent.on(:post_created) do |post, opts, _user|
    if post.is_first_post?
      Rails.logger.debug "discourse-paid-pinning: Post created. Opts: #{opts.inspect}"
      if opts[:is_pinned].is_a?(String) ? ::JSON.parse(opts[:is_pinned]) : opts[:is_pinned]
        txn_balance = Txns.balance_of(_user)

        if txn_balance >= SiteSetting.paid_pinning_plugin_fee
          topic = Topic.find(post.topic_id)

          if topic.pinned_at?
            Rails.logger.debug "discourse-paid-pinning: Topic already pinned"
          elsif SiteSetting.paid_pinning_plugin_duration_hours > 0
            pin_until = SiteSetting.paid_pinning_plugin_duration_hours.hours.from_now.to_s
            Rails.logger.debug "discourse-paid-pinning: Pinning topic until #{pin_until}"
            topic.update_pinned(status = true, global = true, pinned_until = pin_until)
            Txns.add_txn(_user,
                         -SiteSetting.paid_pinning_plugin_fee,
                         _user.id,
                         Txns.types[:pinned_topic],
                         topic_id = post.topic_id)
          end
        else
          Rails.logger.error "discourse-paid-pinning: Balance #{txn_balance} insufficient for fee #{SiteSetting.paid_pinning_plugin_fee}"
        end
      end
    end
  end


  PLUGIN_STORE_TXNS_KEY = 'pp_txns'

  require_dependency 'user'

  module ::Txns
    require_dependency 'user'

    class Engine < ::Rails::Engine
      engine_name 'pp_txns'
      isolate_namespace Txns
    end

    def self.types
      @types ||= Enum.new(card: 1,
                          pinned_topic: 2,
                          manual: 3)
    end

    def self.key_for(user_id)
      "txn:#{user_id}"
    end

    def self.txns_for(user_id)
      PluginStore.get('pp_txns', key_for(user_id)) || []
    end

    def self.add_txn(user, amount, created_by, type, topic_id = nil, note = "")

      if user.blank?
        Rails.logger.error "discourse-paid-pinning: Expected user"
        raise Discourse::InvalidParameters
      end

      if amount.blank?
        Rails.logger.error "discourse-paid-pinning: Expected amount"
        raise Discourse::InvalidParameters
      end

      if created_by.blank?
        Rails.logger.error "discourse-paid-pinning: Expected created_by"
        raise Discourse::InvalidParameters
      end

      if type.blank?
        Rails.logger.error "discourse-paid-pinning: Expected type"
        raise Discourse::InvalidParameters
      end

      unless amount.is_a? Integer
        Rails.logger.error "discourse-paid-pinning: Expected integer amount but got #{amount}"
        raise Discourse::InvalidParameters
      end

      unless created_by.is_a? Integer
        Rails.logger.error "discourse-paid-pinning: Expected integer created_by but got #{created_by}"
        raise Discourse::InvalidParameters
      end

      txns = txns_for(user.id)
      record = {
          id: SecureRandom.hex(16),
          user_id: user.id,
          amount: amount.to_i,
          type: type,
          created_by: created_by,
          created_at: Time.now,
          topic_id: topic_id,
          note: note
      }
      Rails.logger.debug "discourse-paid-pinning: Adding transaction #{record}"
      txns << record
      ::PluginStore.set(PLUGIN_STORE_TXNS_KEY, key_for(user.id), txns)
      update_aggregate_fields(user, txns)

      txn_to_publish = record.clone
      txn_to_publish[:created_by] = user
      MessageBus.publish("/user/#{user.id}/new_pp_txn",
                         txn: ::PpTxnSerializer.new(txn_to_publish).as_json,
                         user_ids: [user.id])

      record
    end

    def self.remove(user, txn_id)
      txns = txns_for(user.id)
      txns.reject! { |n| n[:id] == txn_id }

      if txns.size > 0
        ::PluginStore.set(PLUGIN_STORE_TXNS_KEY, key_for(user.id), txns)
      else
        ::PluginStore.remove(PLUGIN_STORE_TXNS_KEY, key_for(user.id))
      end
      update_aggregate_fields(user, txns)
    end

    def self.remove_all(user_id)
      user = User.where(id: user_id).first
      ::PluginStore.remove(PLUGIN_STORE_TXNS_KEY, key_for(user_id))

      MessageBus.publish("/user/#{user.id}/del_all_pp_txns", {}, user_ids: [user.id])

      update_aggregate_fields(user, [])
    end

    def self.update_aggregate_fields(user, txns)
      user.custom_fields[TXN_COUNT_FIELD] = txns.size
      user.custom_fields[TXN_BALANCE_FIELD] = txns.inject(0){|sum,x| sum + x[:amount]}
      user.save_custom_fields
      fields = {}
      fields[:txn_count] = user.custom_fields[TXN_COUNT_FIELD]
      fields[:txn_balance] = user.custom_fields[TXN_BALANCE_FIELD]
      MessageBus.publish("/user/#{user.id}/pp_fields",
                         fields: ::PpUserFieldsSerializer.new(fields).as_json,
                         user_ids: [user.id])
    end

    def self.balance_of(user)
      user.custom_fields[TXN_BALANCE_FIELD].to_i
    end

    def self.txn_count_of(user)
      user.custom_fields[TXN_COUNT_FIELD].to_i
    end

    require_dependency 'application_serializer'

    class InsufficientBalanceError < StandardError
    end


    class ::User
      def stripe_customer_id
        if custom_fields['stripe_customer_id']
          custom_fields['stripe_customer_id']
        else
          nil
        end
      end
    end


    class ::PpUserFieldsSerializer < ApplicationSerializer
      attributes(
          :txn_count,
          :txn_balance
      )

      def txn_balance
        object[:txn_balance]
      end

      def txn_count
        object[:txn_count]
      end
    end

    class ::PpTxnSerializer < ApplicationSerializer
      attributes(
          :id,
          :user_id,
          :amount,
          :type,
          :created_by,
          :created_at,
          :topic_id,
          :note
      )

      def id
        object[:id]
      end

      def user_id
        object[:user_id]
      end

      def amount
        object[:amount]
      end

      def type
        object[:type]
      end

      def created_by
        BasicUserSerializer.new(object[:created_by], scope: scope, root: false)
      end

      def created_at
        object[:created_at]
      end

      def topic_id
        object[:topic_id]
      end

      def note
        object[:note]
      end

      def can_delete
        user.staff?
      end
    end


    require_dependency 'application_controller'

    class Txns::PpTxnsController < ::ApplicationController
      before_action :ensure_logged_in

      def index
        user = User.where(id: params[:user_id]).first

        if !current_user.admin? && current_user.id != user.id
          raise Discourse::InvalidAccess
        end

        raise Discourse::NotFound if user.blank?

        txns = ::Txns.txns_for(params[:user_id])
        render json: {
            extras: { username: user.username },
            pp_txns: create_json(txns)
        }
      end

      def create
        unless current_user.admin?
          raise Discourse::InvalidAccess
        end

        user = User.where(id: params[:txn][:user_id]).first

        raise Discourse::NotFound if user.blank?
        txn = ::Txns.add_txn(user, params[:txn][:amount], current_user.id, Txns.types[:manual])
        render json: create_json(txn)
      end

      def destroy
        unless current_user.admin?
          raise Discourse::InvalidAccess
        end

        user = User.where(id: params[:user_id]).first

        raise Discourse::NotFound if user.blank?
        raise Discourse::InvalidAccess.new unless guardian.can_delete_txn?
        ::Txns.remove(user, params[:id])
        render json: success_json
      end

      protected
        def create_json(obj)
          # Avoid n+1
          if obj.is_a?(Array)
            by_ids = {}
            User.where(id: obj.map { |o| o[:created_by] }).each do |u|
              by_ids[u.id] = u
            end
            obj.each { |o| o[:created_by] = by_ids[o[:created_by]] }
          else
            obj[:created_by] = User.where(id: obj[:created_by]).first
          end
          serialize_data(obj, ::PpTxnSerializer)
        end
    end
  end


  whitelist_staff_user_custom_field(TXN_BALANCE_FIELD)
  whitelist_staff_user_custom_field(TXN_COUNT_FIELD)
  whitelist_staff_user_custom_field(STRIPE_CUSTOMER_ID_FIELD)

  add_to_class(Guardian, :can_delete_txn?) do
    user.admin?
  end

  add_to_serializer(:admin_detailed_user, :pp_txn_balance, false) do
    object.custom_fields && object.custom_fields[TXN_BALANCE_FIELD].to_i
  end

  add_to_serializer(:admin_detailed_user, :pp_txn_count, false) do
    object.custom_fields && object.custom_fields[TXN_COUNT_FIELD].to_i
  end

  add_to_serializer(:admin_detailed_user, :stripe_customer_id, false) do
    object.custom_fields && object.custom_fields[STRIPE_CUSTOMER_ID_FIELD]
  end

  add_to_serializer(:basic_user, :pp_txn_balance, false) do
    if object.is_a?(Array) || object.is_a?(Hash)
      nil
    else
      object.custom_fields && object.custom_fields[TXN_BALANCE_FIELD].to_i
    end
  end

  add_to_serializer(:basic_user, :pp_txn_count, false) do
    if object.is_a?(Array) || object.is_a?(Hash)
      nil
    else
      object.custom_fields && object.custom_fields[TXN_COUNT_FIELD].to_i
    end
  end

  add_to_serializer(:current_user, :pp_txn_balance, false) do
    if object.is_a?(Array) || object.is_a?(Hash)
      nil
    else
      object.custom_fields && object.custom_fields[TXN_BALANCE_FIELD].to_i
    end
  end

  add_to_serializer(:current_user, :pp_txn_count, false) do
    if object.is_a?(Array) || object.is_a?(Hash)
      nil
    else
      object.custom_fields && object.custom_fields[TXN_COUNT_FIELD].to_i
    end
  end

  add_to_serializer(:post, :pp_txn_balance, false) {
    object.user.custom_fields[TXN_BALANCE_FIELD].to_i
  }

  add_to_serializer(:post, :pp_txn_count, false) {
    object.user.custom_fields[TXN_COUNT_FIELD].to_i
  }

  Txns::Engine.routes.draw do
    get '/' => 'pp_txns#index'
    post '/' => 'pp_txns#create'
    delete '/:id' => 'pp_txns#destroy'
  end

  Discourse::Application.routes.append do
    mount ::Txns::Engine, at: '/pp_txns'
  end

  Discourse::Application.routes.prepend do
    mount ::DiscourseStripe::Engine, at: '/'
  end
end