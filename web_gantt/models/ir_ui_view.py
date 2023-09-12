# -*- coding: utf-8 -*-

from odoo import models, fields


class IrUiView(models.Model):
    _inherit = 'ir.ui.view'
    
    type = fields.Selection(selection_add=[('webgantt', 'Gantt Chart')], ondelete={'webgantt': 'cascade'})

