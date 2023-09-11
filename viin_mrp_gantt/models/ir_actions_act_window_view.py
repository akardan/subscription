# -*- coding: utf-8 -*-

from odoo import models, api

    
class IrActionsActWindowView(models.Model):
    _inherit = 'ir.actions.act_window.view'

    @api.model
    def _get_mrp_actions_for_gantt(self):
        return [
            'mrp.mrp_production_action',
            'mrp.mrp_production_action_picking_deshboard',
            'mrp.mrp_production_report',
            'mrp.action_mrp_routing_time',
            'mrp.action_mrp_workorder_production_specific',
            'mrp.action_mrp_workorder_workcenter',
            'mrp.action_mrp_workorder_production',
            'mrp.mrp_workorder_todo',
            'mrp.action_mrp_workcenter_load_report_graph',
            'mrp.action_work_orders',
            ]
        
    @api.model
    def _add_mrp_gantt_view(self):
        self._add_gantt_view(self._get_mrp_actions_for_gantt())
