# -*- coding: utf-8 -*-

from . import models
from odoo import api, SUPERUSER_ID


def _remove_gantt_view(env):
    action = env['ir.actions.act_window.view']
    action._remove_gantt_view(action._get_mrp_actions_for_gantt())


def uninstall_hook(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    _remove_gantt_view(env)
