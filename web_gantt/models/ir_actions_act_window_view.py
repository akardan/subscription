# -*- coding: utf-8 -*-

from odoo import models, fields, api

    
class IrActionsActWindowView(models.Model):
    _inherit = 'ir.actions.act_window.view'
    
    view_mode = fields.Selection(selection_add=[('webgantt', 'Gantt Chart')], ondelete={'webgantt': 'cascade'})
    
    @api.model
    def _add_gantt_view(self, actions_for_gantt=[]):
        for action_name in actions_for_gantt:
            action = self.env.ref(action_name)
            view_mode_list = action.view_mode.split(',')
            if 'webgantt' not in view_mode_list:
                view_mode_list.append('webgantt')
                action.write({
                    'view_mode': ','.join(view_mode_list)
                })

    @api.model
    def _remove_gantt_view(self, actions_for_gantt=[]):
        for action_name in actions_for_gantt:
            action = self.env.ref(action_name)
            view_mode_list = action.view_mode.split(',')
            if 'webgantt' in view_mode_list:
                view_mode_list.remove('webgantt')
                action.write({
                    'view_mode': ','.join(view_mode_list)
                    })

    @api.model
    def _get_project_actions_for_gantt(self):
        return [
            'project.open_view_project_all',
            ]
        
    @api.model
    def _add_project_gantt_view(self):
        self._add_gantt_view(self._get_project_actions_for_gantt())