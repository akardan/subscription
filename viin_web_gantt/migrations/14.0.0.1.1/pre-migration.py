# -*- coding: utf-8 -*-
from odoo import api, SUPERUSER_ID


def _fix_translation_terms(env):
    terms = env['ir.translation'].search([
        ('src', '=', 'undefined'),
        ('value', '=', 'không xác định'),
        ('name', 'ilike', '%viin_web_gantt%'),
        ])
    terms.unlink()


def migrate(cr, version):
    env = api.Environment(cr, SUPERUSER_ID, {})
    _fix_translation_terms(env)

