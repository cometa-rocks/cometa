"""
Position Encoder Configuration

Central configuration for all position-based encodings in the system.
"""

from .position_encoder import PositionEncoder

# Configure Feature model encoding
feature_encoder = PositionEncoder.register('Feature')

# Position 0: Email notification frequency (1 character)
feature_encoder.add_position(
    position=0,
    attribute_name='email_notification_frequency',
    choices=[
        ('A', 'ALWAYS'),
        ('E', 'ON ERROR'),
        ('S', 'ON SUCCESS'),
    ],
    required_field='send_mail',
    check_enabled=True,
    width=1
)

# Position 1: Telegram notification frequency (1 character)
feature_encoder.add_position(
    position=1,
    attribute_name='telegram_notification_frequency',
    choices=[
        ('A', 'ALWAYS'),
        ('E', 'ON ERROR'),
        ('S', 'ON SUCCESS'),
    ],
    required_field='send_telegram_notification',
    check_enabled=True,
    width=1
)

# Example: Position 2: Retry count (2 characters - supports 00-99)
# feature_encoder.add_position(
#     position=2,
#     attribute_name='retry_count',
#     choices=[
#         ('00', 'No Retry'),
#         ('01', '1 Retry'),
#         ('02', '2 Retries'),
#         ('03', '3 Retries'),
#         ('05', '5 Retries'),
#         ('10', '10 Retries'),
#         ('15', '15 Retries'),
#         ('20', '20 Retries'),
#         ('99', 'Unlimited'),
#     ],
#     required_field=None,  # Always active
#     check_enabled=False,
#     width=2  # Two characters, default='__'
# )

# Example: Position 3: Country code (2 characters)
# feature_encoder.add_position(
#     position=3,
#     attribute_name='default_country',
#     choices=[
#         ('US', 'United States'),
#         ('UK', 'United Kingdom'),
#         ('DE', 'Germany'),
#         ('FR', 'France'),
#         ('ES', 'Spain'),
#         ('MX', 'Mexico'),
#         ('CA', 'Canada'),
#         ('JP', 'Japan'),
#         ('CN', 'China'),
#         ('IN', 'India'),
#     ],
#     required_field=None,
#     check_enabled=False,
#     width=2  # Two characters, default='__'
# )

# Future positions can be added here
# Position 2: Slack notifications
# feature_encoder.add_position(
#     position=2,
#     attribute_name='slack_notification_frequency',
#     choices=[
#         ('A', 'ALWAYS'),
#         ('E', 'ON ERROR'),
#         ('S', 'ON SUCCESS'),
#         ('D', 'DISABLED'),
#     ],
#     required_field='send_slack_notification',
#     check_enabled=True
# )

# Position 3: Execution priority
# feature_encoder.add_position(
#     position=3,
#     attribute_name='execution_priority',
#     choices=[
#         ('H', 'HIGH'),
#         ('M', 'MEDIUM'),
#         ('L', 'LOW'),
#     ],
#     required_field=None,  # Always active
#     check_enabled=False
# )

# Export for easy import
__all__ = ['feature_encoder']