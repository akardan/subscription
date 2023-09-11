# -*- coding: utf-8 -*-

from odoo import models, fields, api

    
class IrActionsActWindowView(models.Model):
    _inherit = 'ir.actions.act_window.view'
    
    view_mode = fields.Selection(selection_add=[('viin_gantt', 'Gantt Chart')], ondelete={'viin_gantt': 'cascade'})
    
    @api.model
    def _add_gantt_view(self, actions_for_gantt=[]):
        """
        This model method is to add `viin_gantt` to the given actions. This is usually called by xml function to keep the view for the action

        @param actions_for_gantt: list of window action xml_ids into which the viin_gantt will be added
        """
        for action_name in actions_for_gantt:
            action = self.env.ref(action_name)
            view_mode_list = action.view_mode.split(',')
            if 'viin_gantt' not in view_mode_list:
                view_mode_list.append('viin_gantt')
                action.write({
                    'view_mode': ','.join(view_mode_list)
                    })

    @api.model
    def _remove_gantt_view(self, actions_for_gantt=[]):
        """
        This model method is to add `viin_gantt` to the given actions. This is usually called by uninstall hook to remove the view from the action

        @param actions_for_gantt: list of window action xml_ids from which the viin_gantt will get removed
        """
        for action_name in actions_for_gantt:
            action = self.env.ref(action_name)
            view_mode_list = action.view_mode.split(',')
            if 'viin_gantt' in view_mode_list:
                view_mode_list.remove('viin_gantt')
                action.write({
                    'view_mode': ','.join(view_mode_list)
                    })
