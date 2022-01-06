# Import all models and all the utility methods
from backend.models import *
# import django exceptions
from django.core.exceptions import *
from rest_framework import viewsets
from rest_framework.renderers import JSONRenderer
from django.http import JsonResponse, HttpResponse
import secret_variables
from rest_framework import serializers
from django.db.models import Q
from django.db.models import Sum
from django.conf import settings
import json
import stripe
import logging
import time
from datetime import datetime, timedelta
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from sentry_sdk import capture_exception
from math import ceil
from backend.utility.functions import get_model, get_nested_dict_property, getLogger

# logger information
logger = getLogger()

DOMAIN = getattr(secret_variables, 'COMETA_DOMAIN', '')

# Custom exception: When no payment is necessary
class PaymentNotRequired(Exception):
    pass

# Custom exception: When not PaymentRequest is found
class PaymentRequestNotFound(Exception):
    pass

# Custom exception: When the user tries to access a browser outside his cloud subscriptions
class ForbiddenBrowserCloud(Exception):
    pass

class InactiveBrowserCloud(Exception):
    pass

class BudgetAhead(Exception):
    pass

# Custom exception: When the requested customer is not found in our database
class CustomerNotFound(Exception):
    pass

# Custom exception: When the requested feature is not found in our database
class FeatureNotFound(Exception):
    pass

# Custom exception: When the request invoice is not found in out database
class InvoiceNotFound(Exception):
    pass

# Custom exception: When a getter function cannot retrieve the requested model
class GetterModelNotFound(Exception):
    pass

# Retrun True if server should be subscription based
def get_requires_payment():
    if is_testing_mode():
        key = 'COMETA_STAGE_ENABLE_PAYMENT'
    else:
        key = 'COMETA_PROD_ENABLE_PAYMENT'
    requires_payment = getattr(secret_variables, key, False)
    if requires_payment:
        return requires_payment == 'True'
    else:
        return False

# Return True if current server should use test mode
def is_testing_mode():
    return 'stage.cometa.' in DOMAIN or 'cometa-dev.ddns.net' in DOMAIN or DOMAIN == 'localhost'

# Returns Stripe instance with Live Key injected
def get_live_stripe():
    KEY = getattr(secret_variables, 'COMETA_STRIPE_LIVE_KEY', False)
    if KEY:
        stripe.api_key = KEY
        return stripe
    else:
        raise Exception('Stripe Live API Key not set.')

# Returns Stripe instance with Test Key injected
def get_test_stripe():
    KEY = getattr(secret_variables, 'COMETA_STRIPE_TEST_KEY', False)
    if KEY:
        stripe.api_key = KEY
        return stripe
    else:
        raise Exception('Stripe Test API Key not set.')

def get_test_webhook_secret():
    WEBHOOK_SECRET = getattr(secret_variables, 'COMETA_STRIPE_TEST_WEBHOOK_SECRET', False)
    if WEBHOOK_SECRET:
        return WEBHOOK_SECRET
    else:
        raise Exception('Stripe Test Webhook Secret not set')

def get_live_webhook_secret():
    WEBHOOK_SECRET = getattr(secret_variables, 'COMETA_STRIPE_LIVE_WEBHOOK_SECRET', False)
    if WEBHOOK_SECRET:
        return WEBHOOK_SECRET
    else:
        raise Exception('Stripe Live Webhook Secret not set')

def get_stripe_charge_automatically():
    CHARGE_AUTOMATICALLY = getattr(secret_variables, 'COMETA_STRIPE_CHARGE_AUTOMATICALLY', False)
    if CHARGE_AUTOMATICALLY:
        return CHARGE_AUTOMATICALLY
    else:
        raise Exception('COMETA_STRIPE_CHARGE_AUTOMATICALLY not found in secret_variables')

def get_webhook_secret():
    return get_test_webhook_secret() if is_testing_mode() else get_live_webhook_secret()

# Use this function for any future usage of Stripe
def get_stripe():
    return get_test_stripe() if is_testing_mode() else get_live_stripe()

# Retrieves the number of hours of usage for a given user and month
# If period_start and period_end is passed, not period is filtered
# If no cloud is passed, all clouds will be included
# Parameters:
#  - formatting: hours | minutes | seconds | milliseconds
#  - ceilResult: True | False
def get_user_usage(user_id, period_start, period_end, cloud, **kwargs):
    # Add parameters for more precision
    formatting = kwargs.get('formatting', 'hours')
    ceilResult = kwargs.get('ceilResult', True)
    # First get all results (including removed) within a user and exclude department Default (those are free to run)
    results = Feature_result.all_objects.filter(executed_by__user_id = user_id).exclude(department_name='Default')
    # Filter by period_start and period_end
    if isinstance(period_start, datetime) and isinstance(period_end, datetime):
        results = results.filter(result_date__gte = period_start, result_date__lte = period_end)
    # Get stripe customer id
    cloud = get_model(cloud, Cloud)
    # Filter by passed cloud
    if cloud is not None:
        if cloud.name == 'browserstack':
            # Browserstack browsers don't have a cloud key, therefore we have to search for nulls
            results = results.filter(browser__cloud__isnull=True)
        elif cloud.name == 'local':
            results = results.filter(browser__cloud='local')
        else:
            raise Exception('get_user_usage: Cloud %s not handled.' % cloud)
    if not results.exists():
        # User hasn't yet executed any feature
        return 0
    # Get total execution time
    milliseconds = results.aggregate(Sum('execution_time'))['execution_time__sum']
    # Interpret None as 0
    if milliseconds is None:
        return 0
    # Convert milliseconds to requested formatting and return
    divider = 0
    if formatting == 'hours':
        divider = 1000 * 60 * 60
    elif formatting == 'minutes':
        divider = 1000 * 60
    elif formatting == 'seconds':
        divider = 1000
    if ceilResult:
        return ceil( milliseconds / divider )
    else:
        return milliseconds / divider

# Extracts the subscriptions array from the session request
def get_subscriptions_from_request(request):
    return request.session['user']['subscriptions'] or []

# Returns True if 1 subscription of the user is on cloud Local and is active
def has_subscription_by_cloud(subscriptions, cloud):
    subs = [ sub for sub in subscriptions if str(sub['cloud']).lower() == str(cloud).lower() ]
    return len(subs) > 0

# Returns True if 1 subscription of the user is on cloud Local and is active
def has_subscription_by_cloud(subscriptions, cloud):
    subs = [ sub for sub in subscriptions if str(sub['cloud']).lower() == str(cloud).lower() ]
    return len(subs) > 0

# Returns an array of filtered browsers for a cloud
def get_browsers_by_cloud(browsers, cloud):
    return [ browser for browser in browsers if str(browser.get('cloud', 'browserstack')).lower() == str(cloud).lower() ]

# Checks if the current logged user has access to the passed browsers
def check_browser_access(browsers, subscriptions):
    # Now we verify the assigned browsers to this feature
    # If user tries to run a feature with browsers not included in their subscriptions
    # we will throw an error to Front
    if len(browsers) > 0:
        # Get available clouds
        clouds = Cloud.objects.all()
        for cloud in clouds:
            # Check current cloud
            cloud_browsers = get_browsers_by_cloud(browsers, cloud.name)
            # Check if the feature has a browser in an inactive cloud
            if len(cloud_browsers) > 0 and not cloud.active:
                raise InactiveBrowserCloud('Cloud %s is inactive.' % cloud.name)
            # Check if the feature has a browser in an inactive cloud subscription
            if get_requires_payment():
                if len(cloud_browsers) > 0 and not has_subscription_by_cloud(subscriptions, cloud.name):
                    raise ForbiddenBrowserCloud('Missing subscription to %s cloud.' % cloud.name)

def get_user_subscriptions(user, **kwargs):
    serialize = kwargs.get('serialize', True)
    if not get_requires_payment():
        return []
    # Get stripe customer id
    user = get_model(user, OIDCAccount)
    # Retrieve Stripe instance
    # stripe = get_stripe()
    # if not user.stripe_customer_id:
        # return []
    # Retrieve customer information including his subscriptions
    # json = stripe.Customer.retrieve(user.stripe_customer_id, expand=['subscriptions'])
    today = datetime.utcnow()
    # Get subscriptions for the logged user, within today and being 'active'
    subscriptions = UserSubscription.objects.filter(
        user__user_id = user.user_id,
        period_start__lte = today,
        period_end__gte = today,
        status = 'active'
    )
    if serialize:
        subscriptions = map(lambda sub: sub.subscription, subscriptions)
        return SubscriptionPublicSerializer(subscriptions, many=True).data
    else:
        return subscriptions
    """ subscriptions = []
    try:
        # Iterate over each subscription the customer has and map it to our subscription object in database
        if len(json['subscriptions']['data']) > 0:
            # Prefetch subscriptions
            db_subs = Subscription.objects.all()
        for sub in json['subscriptions']['data']:
            price_id = sub['plan']['id']
            is_active = sub['status'] == 'active'
            subscription = db_subs.get(test_stripe_subscription_id=price_id) if is_testing_mode() else db_subs.get(live_stripe_subscription_id=price_id)
            subscription = SubscriptionPublicSerializer(subscription, many=False).data
            subscription.setdefault('active', is_active)
            subscriptions.append(subscription)
    except Exception as err:
        print(str(err))
    return subscriptions """

# Create a payment record for the given user, subscription id and type
# user: OIDCAccount comming from database
# sub_id: ID of Subscription used
def createPaymentFor(user, sub_id):
    # Retrieve pre-configured stripe service
    stripe = get_stripe()
    # Get subscription
    subscription = Subscription.objects.filter(id=sub_id)
    if not subscription.exists():
        raise Exception('Subscription id not found.')
    subscription = subscription[0]
    # Create Payment Request in database
    payment_request = PaymentRequest(
        user = user,
        subscription = subscription,
        status = 'Created'
    )
    payment_request.save()
    # Create payment
    session = stripe.checkout.Session.create(
        success_url = 'https://%s/#/pricing/success' % DOMAIN,
        cancel_url = 'https://%s/#/pricing' % DOMAIN,
        payment_method_types = ['card'],
        line_items = [
            {
                'price': subscription.test_stripe_subscription_id if is_testing_mode() else subscription.live_stripe_subscription_id,
                'quantity': 1
            }
        ],
        customer = user.stripe_customer_id,
        client_reference_id = user.user_id,
        mode = 'subscription',
        metadata = {
            'payment_request_id': payment_request.id
        },
    )
    # Retrieve session id of payment
    payment_request.stripe_session_id = session.id
    payment_request.save()
    return payment_request

# This function tries to retrieve the OIDCAccount by either the customerId provided by Stripe
# or the email address in the Stripe Customer object
def get_account_from_customer_id(stripe_customer_id):
    # Search account by Stripe customer id
    accounts = OIDCAccount.objects.filter(stripe_customer_id=stripe_customer_id)
    if accounts.exists():
        # Account found
        return accounts[0]
    # Account was not found, try to get it from Stripe Customer Email
    stripe = get_stripe()
    customer = stripe.Customer.retrieve(stripe_customer_id)
    if customer.get('deleted', None):
        raise CustomerNotFound('Requesting customer has been deleted from Stripe')
    accounts = OIDCAccount.objects.filter(email=customer.email)
    if accounts.exists():
        # Account found
        return accounts[0]
    raise CustomerNotFound('Unable to find customer %s in our database.' % stripe_customer_id)
    
# This function checks if the given OIDCAccount has a stripe customer id
# If found: Will try to retrieve info from Stripe and reassign id
# If not found: Will be created in Stripe and assign id
def check_stripe_customer(user):
    user = get_model(user, OIDCAccount)
    if user.stripe_customer_id:
        # Also check if stripe_customer_id is valid
        stripe = get_stripe()
        try:
            stripe_customer = stripe.Customer.retrieve(user.stripe_customer_id)
        except stripe.error.InvalidRequestError:
            # The customer doesn't exist
            customerId = create_stripe_customer(user)
            user.stripe_customer_id = customerId
            user.save()
    else:
        customerId = create_stripe_customer(user)
        user.stripe_customer_id = customerId
        user.save()
    return user

def create_stripe_customer(user):
    stripe = get_stripe()
    # Create customer in Stripe using user information from our database
    customer = stripe.Customer.create(
        email = user.email,
        name = user.name
    )
    return customer['id']

@csrf_exempt
@require_http_methods(['POST'])
def createPaymentSession(request):
    logger.debug('Entering createPaymentSession')
    if not get_requires_payment():
        logger.info('COMETA_ENABLE_PAYMENT is set to False. Please set it to True to enable payments.')
        return HttpResponse(status=402)
    # Get data from body payload
    data = json.loads(request.body)
    # Get and check subscription id
    sub_id = data.get('subscription', None)
    if not sub_id:
        logger.debug('Invalid subscription id or not found.')
        return JsonResponse({ 'success': False, 'error': 'Invalid subscription id or not found.' }, status=400)
    # Get and check user in session
    user = request.session['user']
    if not user:
        logger.debug('Invalid logged user.')
        return JsonResponse({ 'success': False, 'error': 'Invalid logged user.' }, status=403)
    user = OIDCAccount.objects.get(user_id=user['user_id'])
    # Create customer object in Stripe if doesn't exist already
    logger.debug('Checking user exists in Stripe ...')
    user = check_stripe_customer(user)
    # Remove older pending requests of same type
    logger.debug('Deleting any other dangling PaymentRequest for the current user (%s).' % str(user.user_id))
    PaymentRequest.objects.filter(Q(user__user_id=user.user_id) & Q(status='Created')).delete()
    # Create payment and handle errors
    try:
        logger.debug('Creating PaymentRequest for user %s and subscription %s' % (str(user.user_id), str(sub_id)))
        payment_request = createPaymentFor(user, sub_id)
        return JsonResponse({ 'success': True, 'sessionId': payment_request.stripe_session_id }, status=201)
    except PaymentNotRequired as err:
        logger.info('Payment is not required, continuing...')
        return JsonResponse({ 'success': True }, status=200)
    except Exception as err:
        logger.error(str(err))
        return JsonResponse({ 'success': False, 'error': str(err) }, status=503)

def log_stripe_webhook(webhook, handled):
    event_type = webhook.get('type', '')
    StripeWebhook.objects.create(
        event_type = event_type,
        handled = handled,
        event_json = webhook
    )

def customer_first_payment_method(customerId, method_type):
    methods = stripe.PaymentMethod.list(
        customer = customerId,
        type = method_type
    )['data']
    if len(methods) > 0:
        return get_nested_dict_property(methods, '0.id')
    else:
        return None

# Retrieve current usage money of a given user (as EUR)
def get_user_usage_money(user):
    """
    Calculate total spended money for the user
    """
    # Get user
    user = get_model(user, OIDCAccount)
    # Get user active subscriptions
    active_subscriptions = get_user_subscriptions(user, serialize=False)
    # Initialize total money
    total_money = 0
    # Iterate over each subscription and calculate total spend money for each
    for sub in active_subscriptions:
        # Get spended seconds in current subscription, getting seconds instead
        # of hours allows for more precision
        seconds = get_user_usage(
            user.user_id,
            sub.period_start,
            sub.period_end,
            sub.subscription.cloud,
            formatting='seconds',
            ceilResult=False
        )
        # Convert subscription price_hour to price per second
        price_second = float(sub.subscription.price_hour) / 60 / 60
        # Calculate total money for current subscription
        total = seconds * price_second
        # Add to total usage money
        total_money += total
    return total_money

# Check if the given user has budget enabled
def check_enabled_budget(user):
    # Get user
    user = get_model(user, OIDCAccount)
    # Only continue if user has enabled budget
    return get_requires_payment() and user.settings.get('enable_budget', False)

# Checks if the feature that is about to run can exceed the user budget
def check_user_will_exceed_budget(user, featureId):
    """
    Calculate total spended money for the user
    """
    # Get user
    user = get_model(user, OIDCAccount)
    # Only continue if user has enabled budget
    enable_budget = check_enabled_budget(user)
    if not enable_budget:
        # Budget is not enabled, user can proceed
        return False
    # Retrieve current usage money of user
    total_money = get_user_usage_money(user)
    logger.debug('Current user total usage: %f €' % round(total_money, 5))
    # Get user budget
    max_budget = user.settings.get('budget', None)
    if max_budget is None:
        logger.warning('User has not set a budget.')
        # Budget limit is not properly configured, user can proceed
        return False
    """
    Check if current usage is already exceeding budget limit
    """
    logger.debug('Configured budget: %f €' % round(max_budget, 3))
    if total_money >= max_budget:
        # Budget limit is reached, user cannot proceed unless confirmed
        return True
    """
    Current usage is below budget limit
    Now calculate predicted money spend on next run
    """
    # Retrieve last feature run duration
    feature = Feature.objects.get(feature_id=int(featureId))
    runs = feature.feature_runs.order_by('-date_time')
    if not runs.exists():
        logger.debug('Feature doesn\'t have runs')
        # There are no previous runs, will check if the current usage is 5% ahead of the total budget
        percent_threshold = max_budget - (max_budget * 5 / 100)
        logger.debug('Budget threshold: %f €' % round(percent_threshold, 3))
        if total_money >= percent_threshold:
            logger.debug('Remaining usage is 5%% below budget')
            # Budget limit is about to be exceeded, user cannot proceed unless confirmed
            raise BudgetAhead('Your current usage almost exceeds your budget limit.')
        else:
            # Current usage is 5% below of total budget, user can proceed
            return False
    else:
        logger.debug('Using last run to predict if will exceed budget')
        predicted_money = 0
        last_run_results = runs[0].feature_results.filter()
        # Iterate each feature result and get cost of each
        for result in last_run_results:
            # Get cloud of result
            cloud = result.browser.get('cloud', 'browserstack')
            # Retrieve the subscription used in the result datetime
            sub = UserSubscription.objects.filter(user__user_id = user.user_id,
                period_start__lte = result.result_date,
                period_end__gte = result.result_date,
                subscription__cloud__name__iexact=cloud
            )
            if sub.exists():
                price_hour = float(sub[0].subscription.price_hour)
                # Convert units to milliseconds
                price_millisecond = price_hour / 60 / 60 / 1000
            else:
                # Interpret not found subscription as 0,
                # this can happen if payments are enabled on a previously free tier server
                price_millisecond = 0
            # Calculate total result price
            amount = price_millisecond * result.execution_time
            # Add it to total predicted money
            predicted_money += amount
        logger.debug('Predicted money usage: %f €' % round(predicted_money, 3))
        # Sum predicted money + current total and check
        current_and_predicted = total_money + predicted_money
        logger.debug('Predicted + current usage: %f €' % round(current_and_predicted, 3))
        return current_and_predicted >= max_budget

# Automatically created an invoice with the used hours for each cloud within a period
def createUsageInvoice(user_subscription):
    logger.debug('Entering createUsageInvoice ...')
    user_subscription = get_model(user_subscription, UserSubscription)
    user = get_model(user_subscription.user, OIDCAccount)
    user = check_stripe_customer(user)
    # Collect all total hours for the invoice
    logger.debug('Retrieving total usage hours for user %s' % str(user.user_id))
    hours = get_user_usage(user.user_id, user_subscription.period_start, user_subscription.period_end, user_subscription.subscription.cloud)
    # Create a new invoice item in database (even when hours = 0)
    stripe = get_stripe()
    # - Make sure the customer has at least one payment method, if not, we will use the first available method
    # extra_args = {}
    # pay_method = customer_first_payment_method(user.stripe_customer_id, 'card')
    # if pay_method:
        # extra_args['default_payment_method'] = pay_method
    # - Create invoice item with hours assigned to customer and created invoice
    priceId = user_subscription.subscription.test_stripe_price_id if is_testing_mode() else user_subscription.subscription.live_stripe_price_id
    logger.debug('Creating invoice item with hours used and price coming from corresponding subscription price_hour')
    invoice_item = stripe.InvoiceItem.create(
        customer = user.stripe_customer_id,
        price = priceId,
        quantity = hours,
        currency = 'eur',
        period = {
            'start': int(user_subscription.period_start.timestamp()),
            'end': int(user_subscription.period_end.timestamp())
        },
        description = 'Payment of subscription period usage hours.'
    )
    #  - Create draft invoice
    charge_method = 'charge_automatically' if get_stripe_charge_automatically() else 'send_invoice'
    logger.debug('Creating invoice (it takes any previously created invoice item)')
    stripe_invoice = stripe.Invoice.create(
        customer = user.stripe_customer_id,
        collection_method = charge_method,
        auto_advance = True
    )
    # - Create invoice in our database
    logger.debug('Copying created invoice to our database')
    db_invoice = UsageInvoice.objects.create(
        user = user,
        stripe_invoice_id = stripe_invoice.id,
        period_start = user_subscription.period_start,
        period_end = user_subscription.period_end,
        hours = hours,
        total = 0,
        cloud = user_subscription.subscription.cloud,
        status = 'draft'
    )
    # - Finalize invoice
    logger.debug('Finalizing invoice')
    inv = stripe.Invoice.finalize_invoice(stripe_invoice.id)
    # - Calculate is invoice needs to be finalized for payment or doesn't need payment
    total_amount = hours * float(user_subscription.subscription.price_hour)
    if total_amount > 0:
        if not get_stripe_charge_automatically():
            # Send to the user for payment (in testing mode it will not send email, it has to be paid through Stripe Dashboard)
            logger.debug('Telling Stripe to send invoice of usage hours to customer email address ...')
            stripe.Invoice.send_invoice(stripe_invoice.id)
        # Mark db invoice as open
        db_invoice.status = 'open'
        db_invoice.total = total_amount
        db_invoice.save()
    else:
        # Mark db & stripe invoice as paid and leave
        logger.debug('Price is 0, no payment is needed')
        db_invoice.status = 'paid'
        db_invoice.save()
        # stripe.Invoice.pay(stripe_invoice.id) # Marks the invoice in Stripe as paid # NOT NECESSARY

@csrf_exempt
@require_http_methods(['GET'])
def getInvoices(request, invoice_id = None):
    # Get user
    user = get_model(request.session['user']['user_id'], OIDCAccount)
    if invoice_id:
        # Request is for view invoice
        invoice = user.usageinvoice_set.filter(id=int(invoice_id))
        if invoice.exists():
            stripe = get_stripe()
            stripe_invoice = stripe.Invoice.retrieve(invoice[0].stripe_invoice_id)
            return JsonResponse({ 'success': True, 'url': stripe_invoice['hosted_invoice_url'] })
        else:
            return JsonResponse({ 'success': False, 'error': 'No invoice found with id %d' % invoice_id })
    else:
        # Request is for all invoice
        # Get invoices of user
        invoices = user.usageinvoice_set.order_by('-period_end', '-period_start')
        data = UsageInvoiceSerializer(invoices, many=True).data
        return JsonResponse(data, safe=False)

@csrf_exempt
@require_http_methods(['POST'])
def updatePayment(request):
    logger.debug('Entering updatePayment')
    if not get_requires_payment():
        logger.info('COMETA_ENABLE_PAYMENT is set to False. Please set it to True to enable payments.')
        return HttpResponse(status=402)
    stripe = get_stripe()
    # Stripe Webhook verification
    payload = request.body
    sig_header = request.META['HTTP_STRIPE_SIGNATURE']
    event = None
    endpoint_secret = get_webhook_secret()
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except ValueError as e:
        # Invalid payload
        logger.info('Stripe (or someone else) sended an invalid request.')
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        logger.info('Stripe (or someone else) sended a badly signed request.')
        return HttpResponse(status=400)
    json_data = json.loads(payload)
    # Replace dots with underscores in event type
    event_type = event.type.replace('.', '_')
    if event_type in globals():
        # Webhook handler exists
        log_stripe_webhook(json_data, True)
        try:
            webhook_data = event.data.object
        except Exception as err:
            return JsonResponse({ 'error': 'Unable to retrieve data object from Stripe event.' }, status=503)
        # Check if request if for a donation, in that case ignore the request and return 200
        logger.debug('Checking if webhook is for a donation ...')
        if 'donation' in webhook_data.get('success_url', ''):
            logger.debug('Donation detected, ignoring ...')
            return JsonResponse({ 'error': 'Donation ignored' }, status=200)
        # Check handler for Stripe exists
        if event_type not in globals():
            logger.error('Stripe handler `%s` not found ...' % str(event_type))
            return JsonResponse({ 'error': 'Stripe handler not found' }, status=503)
        try:
            # Execute webhook handler
            logger.info('Executing Stripe handler `%s` ...' % str(event_type))
            result = globals()[event_type](webhook_data)
            # Check if function returned something, in that case return the message in Response
            if result is not None:
                if isinstance(result, dict):
                    return JsonResponse(result, status=200)
                elif isinstance(result, str):
                    return HttpResponse(result, status=200)
                else:
                    return HttpResponse(str(result), status=200)
            else:
                return HttpResponse(status=200)
        except PaymentRequestNotFound as err:
            return JsonResponse({ 'error': str(err) }, status=503)
        except Exception as err:
            # Check if the webhook was a donation
            try:
                price_id = None
                if 'lines' in webhook_data:
                    price_id = get_nested_dict_property(webhook_data, 'lines.data.0.price.product')
                elif 'items' in webhook_data:
                    price_id = get_nested_dict_property(webhook_data, 'items.data.0.price.product')
                if price_id:
                    # Get product if of donation
                    products = stripe.Product.list(limit=100).data
                    products = [prod for prod in products if prod['name'] == 'Donation']
                    if len(products) == 0:
                        raise Exception('Unable to retrieve Donation price id')
                    donation_price_id = get_nested_dict_property(products, '0.id')
                    if price_id == donation_price_id:
                        return JsonResponse({ 'success': True }, status=200)
                else:
                    raise Exception('Invalid price id found')
            except KeyError as err:
                logger.error('Unable to find webhook buyed product', err)
            except Exception as err:
                logger.debug(event_type + ' exception:', str(err))
                return JsonResponse({ 'error': str(err) }, status=503)
            logger.debug(event_type + ' exception:', str(err))
            return JsonResponse({ 'error': str(err) }, status=503)
    else:
        log_stripe_webhook(json_data, False)

@csrf_exempt
@require_http_methods(['GET'])
def getCustomerPortal(request):
    user_id = request.session['user']['user_id']
    # Retrieve OIDCAccount
    account = OIDCAccount.objects.filter(user_id=user_id)
    if not account.exists():
        logger.error('Unable to retrieve user account.')
        return JsonResponse({ 'error': 'Unable to retrieve user account' })
    account = account[0]
    # Retrieve stripe_customer_id
    if account.stripe_customer_id:
        stripe = get_stripe()
        session = stripe.billing_portal.Session.create(
            customer=account.stripe_customer_id,
            return_url='https://%s/#/my-account' % DOMAIN,
        )
        if session.url:
            return JsonResponse({ 'success': True, 'url': session.url })
        else:
            logger.debug('Something went wrong while creating customer portal url.')
            return JsonResponse({ 'success': False, 'error': 'Something went wrong' })
    else:
        logger.debug('User account does not have stripe_customer_id')
        return JsonResponse({ 'success': False, 'error': 'Requested user does not have a Stripe Customer ID' })

@csrf_exempt
@require_http_methods(['POST'])
def createDonation(request):
    logger.debug('Entering createDonation')
    # Retrieve Origin of request
    origin = request.META.get('HTTP_ORIGIN', None)
    if origin is None:
        logger.error('Invalid origin header or not passed.')
        return JsonResponse({ 'success': False, 'error': 'Invalid origin header or not passed.' }, status=403)
    # Get data from body payload
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        logger.error('Unable to parse body json.')
        return JsonResponse({ 'success': False, 'error': 'Unable to parse body json.' }, status=400)
    # Retrieve period to donate
    period = data.get('period', None)
    if period is None:
        logger.error('Invalid period value or not passed.')
        return JsonResponse({ 'success': False, 'error': 'Invalid period value or not passed.' }, status=400)
    # Retrieve amount to donate
    amount = data.get('amount', None)
    if amount is None:
        logger.error('Invalid amount value or not passed.')
        return JsonResponse({ 'success': False, 'error': 'Invalid amount value or not passed.' }, status=400)
    # Transform amount to decimals for Stripe
    amount *= 100
    # Retrieve pre-configured stripe service
    stripe = get_stripe()
    # Retrieve products with Donation name
    logger.debug('Checking if Donation product is on Stripe ...')
    products = stripe.Product.list(limit=100).data
    products = [prod for prod in products if prod['name'] == 'Donation']
    # Create donation product if necessary
    if len(products) > 0:
        prod_id = get_nested_dict_property(products, '0.id')
    else:
        logger.debug('Donation product is not on Stripe, creating ...')
        product = stripe.Product.create(
            name='Donation',
            images=['https://cometa.rocks/media/COMETA_prod.png']
        )
        prod_id = product.id
    # Retrieve subscriptions with same billing period and amount
    logger.debug('Checking if Donation product has the selected price on Stripe ...')
    subscriptions = stripe.Price.list(
        limit=100,
        currency='EUR',
        active=True,
        product=prod_id,
        recurring={'interval': period}
    ).data
    # Filter by amount
    subscriptions = [sub for sub in subscriptions if sub['unit_amount'] == amount]
    # Create subscription if necessary
    if len(subscriptions) > 0:
        sub_id = get_nested_dict_property(subscriptions, '0.id')
    else:
        logger.debug('Donation product with selected price is not on Stripe, creating ...')
        price = stripe.Price.create(
            unit_amount=amount,
            currency="EUR",
            recurring={"interval": period},
            product=prod_id
        )
        sub_id = price.id
    # Create checkout session with donation amount
    logger.debug('Creating Stripe checkout with just created Donation subscription ...')
    session = stripe.checkout.Session.create(
        success_url = '%s/?donation=success' % origin,
        cancel_url = '%s/?donation=cancelled' % origin,
        payment_method_types = ['card'],
        line_items = [
            {
                'price': sub_id,
                'quantity': 1
            }
        ],
        mode = 'subscription'
    )
    return JsonResponse({ 'success': True, 'sessionId': session.id }, status=200)

# ==========================
# ==== Stripe Handlers =====
# ==========================

# Stripe Handler: When a checkout session is completed and paid
# This is the main handler used when a user purchases a subscription
def checkout_session_completed(webhook):
    logger.debug('Entering `checkout_session_completed`')
    # Get payment request
    logger.debug('Retrieving payment_request_id')
    payment_request_id = int(get_nested_dict_property(webhook, 'metadata.payment_request_id'))
    logger.debug('payment_request_id: %s' % str(payment_request_id))
    payment_request = PaymentRequest.objects.filter(id=payment_request_id)
    if not payment_request.exists():
        logger.debug('PaymentRequest was not found in our database with ID %s' % str(payment_request_id))
        raise PaymentRequestNotFound('Payment request was not found with id:', request_id)
    # Update payment request
    payment_request = payment_request[0]
    payment_request.status = 'Success'
    payment_request.save()
    return 'Correctly set Payment ID %d with status \'Success\'' % payment_request_id

# Stripe Handler: When the customer is deleted through Stripe Dashboard
# This webhook ensures the customer is recreated when the Customer ID is required
def customer_deleted(webhook):
    logger.debug('Entering `customer_deleted`')
    # Get customer id
    customer_id = webhook['id']
    # Delete stripe customer id field in user account for future recreation
    try:
        account = get_account_from_customer_id(customer_id)
    except CustomerNotFound as err:
        # Ignore customer not found, as it is irrelevant
        return str(err)
    account.stripe_customer_id = ''
    account.save()
    return 'Correctly setted customer_id %s (OIDCAccountID %s) with empty `stripe_customer_id`' % (str(customer_id), str(account.user_id))

# Stripe Handler: When the subscription for a user is created
def customer_subscription_created(webhook):
    return customer_subscription_created_or_updated(webhook)

# Stripe Handler: When the subscription for a user is updated
# Any change in the subscription object of Stripe will cause this webhook to be fired
# For example:
#  - When the subscription status changes to incomplete, incomplete_expired, trialing, active, past_due, canceled, or unpaid
#  - When the subscription expiration date changes due to a month renewal
def customer_subscription_updated(webhook):
    return customer_subscription_created_or_updated(webhook)

# Wrapper for customer_subscription_updated and customer_subscription_created,
# as both have the same code
def customer_subscription_created_or_updated(webhook):
    logger.debug('Entering `customer_subscription_created_or_updated`')
    # Get user subscription of our backend
    sub_id = webhook.get('id', None)
    if sub_id:
        stripe = get_stripe()
        # Try to get user subscription from our backend
        logger.debug('Retrieving subscription price id from webhook ...')
        subscription_info = get_nested_dict_property(webhook, 'items.data.0.price')
        # Get subscription details from our backend
        if is_testing_mode():
            subscriptionRef = Subscription.objects.get(test_stripe_subscription_id=subscription_info.get('id'))
        else:
            subscriptionRef = Subscription.objects.get(live_stripe_subscription_id=subscription_info.get('id'))
        logger.debug('Subscription price id: %s' % str(subscription_info.get('id', '')))
        # Get OIDCAccount using customer id
        logger.debug('Retrieving OIDCAccount with customerId: %s' % str(webhook.get('customer')))
        user = get_account_from_customer_id(webhook.get('customer'))
        # Create or Update user subscription
        data_update = {
            'period_start': datetime.utcfromtimestamp(webhook.get('current_period_start')),
            'period_end': datetime.utcfromtimestamp(webhook.get('current_period_end')),
            'status': webhook.get('status')
        }
        logger.debug('New period_start: %s' % str(data_update['period_start']))
        logger.debug('New period_end: %s' % str(data_update['period_end']))
        logger.debug('New status: %s' % str(data_update['status']))
        try:
            logger.debug('Retrieving UserSubscription with sub_id: %s' % str(sub_id))
            user_subscription = UserSubscription.objects.get(stripe_subscription_id = sub_id)
            # Compare old period_end and new period_end
            # If new period_end is newer than older, it means the billing cycle of the subscription has been renewed
            # and we have to create an invoice with the usage hours
            logger.debug('Checking if new period_end and previous mismatch, and new period_end is newer than the previous, meaning a renewal.')
            if isinstance(user_subscription.period_end, datetime) and isinstance(data_update['period_end'], datetime) and data_update['period_end'] > user_subscription.period_end:
                logger.info('Renewal detected.')
                # Create invoice of usage hours
                try:
                    logger.debug('Creating usage invoice for UserSubscription ID %s.' % str(user_subscription.id))
                    createUsageInvoice(user_subscription)
                except Exception as err:
                    logger.error('CreateUsageInvoice Error: ' + str(err))
                    capture_exception(err)
                # Due to Stripe only updating period_start/period_end on subscription renewal:
                # In that case we will clone the current UserSubscription object but with the new period start - end
                # This allows to keep a history of subscription period over time without losing data
                # Set passed subscription period as finished
                logger.debug('Marking previous UserSubscription as `finished`')
                user_subscription.status = 'finished'
                user_subscription.save()
                # Modify with new period info
                logger.debug('Creating a copy of the previous UserSubscription with the new period start/end and status')
                user_subscription.pk = None # Setting pk to None will trigger an INSERT instead of UPDATE
                user_subscription.period_start = data_update['period_start']
                user_subscription.period_end = data_update['period_end']
                user_subscription.status = data_update['status']
                user_subscription.stripe_subscription_id = user_subscription.stripe_subscription_id + str(int(time.time())) + '_old' # Mark as old for upcoming webhooks
                user_subscription.save()
                return 'A change in period start/end was detected, therefore the subscription has been renewed for OIDCAccountID %s and UsageInvoice has been emitted.' % str(user.user_id)
            else:
                logger.debug('Renewal NOT detected, updating UserSubscription with webhook data ...')
                UserSubscription.objects.filter(stripe_subscription_id = sub_id).update(**data_update)
                return 'Correctly updated UserSubscription with ID %s with data comming from webhook' % str(sub_id)
        except UserSubscription.DoesNotExist:
            # Create User Subscription with webhook data
            logger.debug('UserSubscription with ID %s not found, creating ...' % str(sub_id))
            UserSubscription.objects.create(
                user = user,
                subscription = subscriptionRef,
                stripe_subscription_id = sub_id,
                **data_update
            )
            return 'Correctly created UserSubscription `%s - %s` for OIDCAccountID %s' % (str(subscriptionRef.cloud), str(subscriptionRef.name), str(user.user_id))
    else:
        raise Exception('Unable to retrieve sub_id from webhook.')

# Stripe Handler: When the subscription for a user is deleted (not expired)
# This handle can only occur when the subscription is deleted through Stripe Dashboard
def customer_subscription_deleted(webhook):
    logger.debug('Entering `customer_subscription_deleted`')
    # Get subscription id from stripe event
    sub_id = webhook['id']
    # Find referred user subscription
    logger.debug('Retrieving UserSubscription with sub_id %s' % str(sub_id))
    sub = UserSubscription.objects.filter(stripe_subscription_id=sub_id)
    if sub.exists():
        sub = sub[0]
        # Create invoice for subscription period
        logger.debug('Creating UsageInvoice for sub_id %s' % str(sub_id))
        createUsageInvoice(sub)
        sub.status = 'deleted'
        sub.save()
        logger.debug('Deleted UserSubscription with ID %s' % str(sub_id))
        return 'Deleted UserSubscription ID %s and emitted UsageInvoice.' % str(sub_id)
    return 'UserSubscription ID %s not found in database.' % str(sub_id)


# Stripe Handler: When the Stripe customer successfully pays an invoice
def invoice_paid(webhook):
    logger.debug('Entering `invoice_paid`')
    # Retrieve customer of invoice
    customer = webhook.get('customer', None)
    if customer is None:
        logger.error('Unable to find customer id in webhook data.')
        raise CustomerNotFound('Unable to find customer id in webhook data.')
    user = get_account_from_customer_id(customer)
    # Retrieve invoice object
    id = webhook.get('id', None)
    if id is None:
        logger.error('Unable to find invoice id in webhook data.')
        raise InvoiceNotFound('Unable to find invoice id in webhook data.')
    invoice = UsageInvoice.objects.filter(stripe_invoice_id=id)
    if invoice.exists():
        # Update invoice status
        invoice.update(status = webhook.get('status', invoice[0].status))
        return 'Correctly setted Invoice with ID %s with status `%s` for OIDCAccount %s' % (str(id), str(webhook.get('status', invoice[0].status)), str(user.user_id))
    elif webhook['billing_reason'] == 'manual':
        logger.error('Unable to find invoice %s in our database.' % id)
        raise InvoiceNotFound('Unable to find invoice %s in our database.' % id)

# Stripe Handler: When Stripe creates a new invoice for a customer
def invoice_created(webhook):
    logger.info('invoice_created method is not implemented.')
    return 'invoice_created method is not implemented.'

# Stripe Handler: 7 days before an invoice of subscription renewal is created
def invoice_upcoming(webhook):
    logger.info('invoice_upcoming method is not implemented.')
    return 'invoice_upcoming method is not implemented.'

# Stripe Handler: When an invoice is deleted
def invoice_deleted(webhook):
    logger.debug('Entering `invoice_deleted`')
    # Retrieve invoice object
    id = webhook.get('id', None)
    if id is None:
        logger.error('Unable to find invoice id in webhook data.')
        raise InvoiceNotFound('Unable to find invoice id in webhook data.')
    invoice = UsageInvoice.objects.filter(stripe_invoice_id=id)
    if invoice.exists():
        # Delete invoice
        logger.debug('Marking invoice as deleted')
        invoice.update(status = 'deleted')
        invoice.save()
    elif webhook['billing_reason'] == 'manual':
        logger.error('Unable to find invoice %s in our database.' % id)
        raise InvoiceNotFound('Unable to find invoice %s in our database.' % id)
    return 'Correctly deleted Invoice ID %s.' % str(id)

# Stripe Handler: Whenever a property of an Stripe invoice changes
def invoice_updated(webhook):
    logger.debug('Entering `invoice_deleted`')
    # Retrieve invoice object
    id = webhook.get('id', None)
    if id is None:
        logger.error('Unable to find invoice id in webhook data.')
        raise InvoiceNotFound('Unable to find invoice id in webhook data.')
    invoice = UsageInvoice.objects.filter(stripe_invoice_id=id)
    if invoice.exists():
        # Delete invoice
        logger.debug('Marking invoice with status `%s`' % str(webhook.get('status')))
        invoice.update(status = webhook.get('status'))
    elif webhook['billing_reason'] == 'manual':
        logger.error('Unable to find invoice %s in our database.' % id)
        raise InvoiceNotFound('Unable to find invoice %s in our database.' % id)
    return 'Correctly updated Invoice ID %s with status `%s`.' % (str(id), str(webhook.get('status')))

class UsageInvoiceSerializer(serializers.ModelSerializer):
    cloud = serializers.SerializerMethodField()

    class Meta:
        model = UsageInvoice
        fields = '__all__'

    def get_cloud(self, obj):
        return obj.cloud.name

############################
# Subscription model serializers with excluded sensitive stripe price IDs #
############################
class SubscriptionPublicSerializer(serializers.ModelSerializer):
    price_hour = serializers.SerializerMethodField()
    fee = serializers.SerializerMethodField()
    cloud = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        exclude = ('live_stripe_price_id', 'live_stripe_subscription_id', 'test_stripe_price_id', 'test_stripe_subscription_id',)

    def get_cloud(self, obj):
        return obj.cloud.name

    def get_price_hour(self, obj):
        return float(obj.price_hour)
    
    def get_fee(self, obj):
        return float(obj.fee)

################################
# User subscription model serializer #
################################
class UserSubscriptionSerializer(serializers.ModelSerializer):
    # subscription = serializers.SerializerMethodField()
    class Meta:
        model = UserSubscription
        fields = '__all__'