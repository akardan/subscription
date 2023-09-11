
# -*- coding: utf-8 -*-

from odoo import api, fields, models

class SaasPlans(models.Model):
    _name = "saas_plans"
    _description = 'SaaS subscription plans.'

    name = fields.Char(
        'Plan',
        required=True
    )
    url = fields.Char(
        'URL'
    )
    image = fields.Binary(
        'image',
    )
    