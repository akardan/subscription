# -*- coding: utf-8 -*-
#################################################################################
#
#   Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>)
#   See LICENSE file for full copyright and licensing details.
#   License URL : <https://store.webkul.com/license.html/>
#
#################################################################################
from urllib.parse import urlparse
from odoo import api, fields, models
from odoo.exceptions import UserError, ValidationError
from . lib import containers, install_module
from odoo.modules.module import get_module_resource
from odoo.models import NewId
from . lib import query
from . lib import saas
import logging
import time
import os
import docker
import base64
import re
from . lib import client


_logger = logging.getLogger(__name__)

STATE = [
    ('draft', "Draft"),
    ('confirm', "Confirmed"),
    ('cancel', "Cancelled")
]

BILLING_CRITERIA = [
    ('fixed', "Fixed Rate"),
    ('per_user', 'Based on the No. of users')
]


class SaasPlans(models.Model):
    _name = "saas.plan"
    _order = "id desc"
    _description = 'Class for managing SaaS subscription plans.'

    @api.depends('name')
    def _compute_db_template_name(self):
        """
            Compute the db_template name by using name and id of the records
        """
        
        for obj in self:
            if obj.name and type(obj.id) != NewId and not obj.db_template:
                template_name = obj.name.lower().replace(" ", "_")
                obj.db_template = "{}_tid_{}".format(template_name, obj.id)

    def _default_saas_server(self):
        """
            Return the default saas server id
        """
        
        saas_servers = self.env['saas.server'].search([])
        if saas_servers:
            return saas_servers[0].id
        return False

    def _get_contract_count(self):
        """
            Set the total contract count associated with this plan
        """
        
        for obj in self:
            contracts = self.env['saas.contract'].search(
                [('plan_id', '=', obj.id)])
            obj.contract_count = len(contracts)

    def action_view_contracts(self):
        """
            Open the contract tree view.
            called from the button on saas plan
        """
        
        contracts = self.env['saas.contract'].search(
            [('plan_id', '=', self.id)])

        action = self.env.ref('odoo_saas_kit.saas_contract_action').read()[0]
        if len(contracts) > 1:
            action['domain'] = [('id', 'in', contracts.ids)]
        elif len(contracts) == 1:
            action['views'] = [(self.env.ref(
                'odoo_saas_kit.saas_contract_form_view').id, 'form')]
            action['res_id'] = contracts.ids[0]
        else:
            action = {'type': 'ir.actions.act_window_close'}
        return action

    @api.onchange('server_id')
    def server_id_change(self):
        """
            Method to set base url of saas plan from the domain name of linked saas server
        """
        
        for obj in self:
            obj.saas_base_url = obj.server_id.server_domain

    name = fields.Char(string='Plan', required=True)
    saas_base_url = fields.Char(string="SaaS Domain(Base URL)", required=True)
    image = fields.Binary(string='Image')
    summary = fields.Char(string="Plan Summary")
    db_dropped = fields.Boolean(string="DB deleted", default=False)

    expiration = fields.Integer(
        'Expiration (hours)',
        help='time to delete database. Use for demo')
    grace_period = fields.Integer(
        'Grace period (days)', help='initial days before expiration')
    product_template_ids = fields.One2many(
        comodel_name="product.template",
        string="Linked Products",
        inverse_name="saas_plan_id")
    use_specific_user_template = fields.Boolean(
        string="Use Specific User Template", help="""Select if you want to provide some specific permissions to your user for acessing its odoo instance which is going to be created by this plan.""")
    template_user_id = fields.Char(string="Database Template User ID", help="""Enter the user_id of User which you have created in the DB Template with some specific permissions or whose permission you want to grant to the user of odoo instances which is going to be created by this plan.""")
    saas_module_ids = fields.Many2many(
        comodel_name="saas.module",
        relation="saas_plan_module_relation",
        column1="plan_id",
        column2="module_id",
        string="Related Modules")
    description = fields.Text('Plan Description')
    recurring_interval = fields.Integer(
        default=1, string='Default Billing Cycle')
    recurring_rule_type = fields.Selection(
        [('daily', 'Day(s)'),
         ('weekly', 'Week(s)'),
         ('monthly', 'Month(s)'),
         ('monthlylastday', 'Month(s) last day'),
         ('yearly', 'Year(s)'),
         ],
        default='monthly',
        string='Recurrence',
        readonly=True
    )
    # total_cycles = fields.Integer(string="Number of Cycles", default=1)
    trial_period = fields.Integer(string="Complimentary(Free) days", default=0)
    # server_setup_type = fields.Selection(selection=SERVER_SETUP, string="Server Setup Type", default="SINGLE", required=True)
    is_multi_server = fields.Boolean(string="Deploy Client's on Remote Server", default=False)
    server_id = fields.Many2one(
        comodel_name="saas.server",
        string="SaaS Server",
        default=_default_saas_server,
        domain=[('state', '=', 'confirm'), ('host_server', '=', 'self')])
    default_saas_servers_ids = fields.One2many(comodel_name="server.priority", inverse_name="saas_plan_id")
    db_template = fields.Char(
        compute='_compute_db_template_name', string="DB Template Name", store=True, help="Enter a uniquie name to create a DB associated to this plan or leave it blank and let odoo to give it a unique name.")
    container_id = fields.Char(string="Instance ID")
    state = fields.Selection(
        selection=STATE, string="States", default="draft")
    contract_count = fields.Integer(
        string='Contract Count', compute='_get_contract_count', readonly=True)
    billing_criteria = fields.Selection(
        selection=BILLING_CRITERIA,
        string="Default Billing Criteria",
        required=True,
        default="fixed")
    per_user_pricing = fields.Boolean(string="User Based Pricing", help="Used to enable the per user costing of end user's instance")
    user_cost = fields.Float(help="PUPC(Per User Per Cycle cost)")
    min_users = fields.Integer(string="Min. No. of user", help="Minimum number of users whose cost client have to pay either created or not", default="1")
    max_users = fields.Integer(string="Max. No. of user", help="End user is not allowed to create user more than Maximum number of user limit. Enter -1 to allow user to create infinte number of user.", default="1")
    due_users_price = fields.Float(string="Due users price", default="1.0")
    user_product = fields.Many2one(comodel_name="product.product", string="Product for user calculation", help="Select a product for calculation costing user pricing.", domain="[('is_user_pricing', '=', True)]") 
    modules_status_ids = fields.One2many(comodel_name="saas.module.status", inverse_name="plan_id", string="Module installed/uninstalled status")
    is_all_installed = fields.Boolean(string="All Modules Installed", default=False)
    
    
    @api.constrains('default_saas_servers_ids')
    def _check_saas_server_priority(self):
        """
        Constraint to check that there should no be same server define in Default saas server more than one time.
        """
        
        if any(len(plan.default_saas_servers_ids) != len(plan.default_saas_servers_ids.mapped('server_id')) for plan in self):
            raise ValidationError(('You cannot define two Priorities lines for the same Server.'))
        for obj in self:
            if obj.is_multi_server and not len(obj.default_saas_servers_ids):
                raise UserError("Please select atleast one server in Default Saas servers")

            for server_id in obj.default_saas_servers_ids.mapped('server_id'):
                for field in ('db_host', 'db_port', 'db_user', 'db_pass'):
                    if server_id.mapped(field) != obj.server_id.mapped(field):
                        raise UserError("Select only those Server whose database server is same as {} server".format(obj.server_id.name))
            return True

    
    @api.onchange('max_users')
    def check_max_user(self):
        """
            Validation for max users max users should not be less than min users
        """
        
        for obj in self:
            if obj.max_users != -1 and obj.max_users < obj.min_users:
                raise UserError("Max. No. of users must be greater than or Equal to Min. no. of users")
            else:
                obj.max_users = obj.max_users

    @api.onchange('min_users')
    def check_min_users(self):
        """
            Validation for min users
        """
        for obj in self:
            if obj.min_users < 1:
                raise UserError("Min. No. of users can't be less than 1")
            if obj.min_users > obj.max_users:
                raise UserError("Max. No. of users must be greater than or Equal to Min. no. of users")

    def reset_to_draft(self):
        """
            Method to change the state of the plan, to allow admin to edit the plans if there is contract is associated with plan.
            Called from Button over plan
        """
        
        for obj in self:
            contracts = self.env['saas.contract'].search([('plan_id', '=', obj.id)])
            if contracts:
                raise UserError("This plan has some contracts associated with it!")
            obj.state = 'draft'

    @api.model
    def select_server(self):
        """
        Select Server in case of Remote server setup type according to their priority and number of clients.
        """
        
        for obj in self:
            if len(obj.default_saas_servers_ids):
                priority_list = list(obj.default_saas_servers_ids)
                priority_list.sort(key = lambda priority_record: priority_record.priority) 
                
                for priority in priority_list:
                    if priority.server_id.max_clients > priority.server_id.total_clients:
                        server = priority.server_id
                        break
                else:
                    return (False, 'All server limits over. Please create a new server!')
                return (True, server)

            else:
                return (False, 'Please select atleast one server in Default Saas servers')
                    
    def login_to_db_template(self):
        """
            Called from the Login button over saas plan
            Redict to the Plan instance to login in to template database
        """
        
        for obj in self:
            host_server, db_server = obj.server_id.get_server_details()
            response = query.get_credentials(
                obj.db_template,
                host_server=host_server,
                db_server=db_server)
            if response.get('status'):
                response = response.get('result')
                login = response[0][0]
                password = response[0][1]
                login_url = "http://db16_templates.{}/saas/login?db={}&login={}&passwd={}".format(obj.saas_base_url,obj.db_template, login, password)


                _logger.info("$$$$$$$$$$$$$$%r", login_url)
                return {
                    'type': 'ir.actions.act_url',
                    'url': login_url,
                    'target': 'new',
                }
            else:
                raise UserError("ERR001: "+str(response.get('message')))

    def restart_db_template(self):
        """
            Method restart the Template Container.
            Called from the Restart button over Saas Plan.
        """
        
        for obj in self:
            host_server, db_server = obj.server_id.get_server_details()
            response_flag = containers.action(
                operation="restart",
                container_id=obj.container_id,
                host_server=host_server,
                db_server=db_server)
            if not response_flag:
                raise UserError("Operation Failed! Unknown Error!")

    def force_confirm(self):
        """
            Method to change the state of plan to Confirm, if the db_template linked to plan is exist.
            Called from the Skip this step Button.
        """
        
        for obj in self:
            response = None
            if not obj.container_id:
                _, db_server = obj.server_id.get_server_details()
                response = query.is_db_exist(obj.db_template, db_server=db_server)
                if not response.get('status'):
                    raise UserError("Please create DB Template First!")
            obj.state = 'confirm'


    def create_status_modules(self):
        for module in self.saas_module_ids:
            if module.id not in self.modules_status_ids.module_id.ids:
                module_created=self.env['saas.module.status'].create({
                    'technical_name' : module.technical_name,
                    'module_id' : module.id,
                    'plan_id' : self.id})
        return True


    def get_installable_modules(self):
        limit = self.server_id.module_installation_limit
        _logger.info("-=-= -= -= -1 12 2 =- limit %s--- "%self.modules_status_ids)
        installable_modules = self.modules_status_ids.filtered(lambda mod:mod.status == 'uninstalled')[:limit]
        _logger.info("-=-= -=1 -= -=121 21 21- limit %r--- "%installable_modules)
        if not installable_modules:
            self.is_all_installed=True
        return installable_modules


    def install_remaining_modules(self):
        installable_modules = self.get_installable_modules()

        modules = [module.technical_name for module in installable_modules]
        host_server, db_server = self.server_id.get_server_details()
        cred_response = query.get_credentials(
                    self.db_template,
                    host_server=host_server,
                    db_server=db_server)
        if cred_response.get('status'):
            response = cred_response.get('result')
            login = response[0][0]
            password = response[0][1]
            try:
                response = install_module.main(dict(
                    db_name=self.db_template,
                    modules=modules,
                    version='16.0',
                    config_path = get_module_resource('odoo_saas_kit'),
                    login=login,
                    password=password))
            except Exception as e:
                    _logger.info("--------MODULE-CREATION-CREATION-EXCEPTION-------%r", e)
                    raise UserError(e)
            else:
                if response:
                    if response.get('modules_installation', False):
                        self.state = 'confirm'
                        for module in installable_modules:
                            module.status="installed"
                            if not self.get_installable_modules():
                                self.is_all_installed=True
                    else:
                        msg = response.get('msg', 'Connection Failure')
                        if msg:
                            raise UserError(msg)
                        else:
                            raise UserError("Unknown Error. Please try again later")
                else:
                    raise UserError("No Response. Please try again later")
        else:
            raise UserError("Details Not found !")

        

        


    def create_db_template(self):
        """
            Method to create the database template of the saas plan and confirm the state of the plan.
            Called from the Create Db Template button over saas plan.
        """
        
        for obj in self:
            if not obj.db_template:
                raise UserError("Please select the DB template name first.")
            if re.match("^template_",obj.db_template):
                raise UserError("Couldn't Create DB. Please try again with some other Template Name!")
            db_template_name = "template_{}".format(obj.db_template)
            config_path = get_module_resource('odoo_saas_kit')
            status_module = obj.create_status_modules()
            installable_modules = obj.get_installable_modules()
            modules = [module.technical_name for module in installable_modules]            
            modules.append('wk_saas_tool')
            try:
                host_server, db_server = obj.server_id.get_server_details()
                response = saas.create_db_template(
                    db_template=db_template_name,
                    modules=modules,
                    config_path=config_path,
                    host_server=host_server,
                    db_server=db_server)
            except Exception as e:
                _logger.info("--------DB-TEMPLATE-CREATION-EXCEPTION-------%r", e)
                raise UserError(e)
            else:
                if response:
                    if response.get('status', False):
                        obj.db_template = db_template_name
                        obj.state = 'confirm'
                        obj.container_id = response.get('container_id', False)
                        for module in installable_modules:
                            module.status="installed"
                            if not self.get_installable_modules():
                                self.is_all_installed=True

                    else:
                        msg = response.get('msg', False)
                        if msg:
                            raise UserError(msg)
                        else:
                            raise UserError("Unknown Error. Please try again later with some different Template Name")
                else:
                    raise UserError("No Response. Please try again later with some different Template Name")

    def cancel_plan(self):
        for obj in self:
            contracts = self.env['saas.contract'].search([('plan_id', '=', obj.id),('state', '!=', 'cancel')])
            if contracts:
                raise UserError("Please Cancel the Linked Contract first before cancel the Plan.")
            else:
                obj.state = 'cancel'

    def unlink(self):
        """
            Unlink of no contrac is associated with the plan
        """
        
        for obj in self:
            if obj.contract_count:
                raise UserError("Error: You must delete the associated SaaS Contracts first!")
        return super(SaasPlans, self).unlink()

    @api.model
    def create(self, vals):
        """
            Added few validation
        """
        
        if vals.get('recurring_interval', 0) <= 0:
            raise UserError("Default Billing Cycle can't be less than 1")
        if vals.get('is_multi_server', False) and not vals.get('default_saas_servers_ids', False):
            raise UserError("Select Atleast one Server in Default Saas Servers")
        

        if vals.get('trial_period', 0) < 0:
            raise UserError("Complimentary Free days can't be less than 0")
        res = super(SaasPlans, self).create(vals)
        for obj in res:
            if obj.name and not obj.db_template:
                template_name = obj.name.lower().replace(" ", "_")
                obj.db_template = "{}_tid_{}".format(template_name, res.id)
        return res

    def write(self, vals):
        """
            Added Few validations
        """
        
        if vals.get('recurring_interval', False) and vals['recurring_interval'] <= 0:
            raise UserError("Default Billing Cycle can't be less than 1")
        if vals.get('trial_period', False) and vals['trial_period'] < 0:
            raise UserError("Complimentary Free days can't be less than 0")
        if vals.get('is_multi_server', False) and not vals.get('default_saas_servers_ids', False):
            raise UserError("Select Atleast one Server in Default Saas Servers")
        res = super(SaasPlans, self).write(vals)
        return res

    def drop_template(self):
        for obj in self:
            linked_plans=self.env['saas.plan'].search([('id','!=',obj.id),('db_template','=',obj.db_template)])
            if not len(linked_plans):
                if obj.state == 'cancel':
                    host_server, db_server = obj.server_id.get_server_details()
                    response = client.main_plan(obj.db_template, host_server, get_module_resource('odoo_saas_kit'))
                    if not response['db_drop']:
                        raise UserError("ERROR: Couldn't Drop Database. Please Try Again Later.\n\nOperation\tStatus\n\nDrop database: \t{}\n".format(response['db_drop']))
                    else:
                        obj.db_dropped=True
                else:
                    raise UserError("Please cancel the Plan first before drop the db.")
            else:
                for plan in linked_plans:
                    if plan.state != 'cancel':
                        raise UserError("Cannot Drop Database: Active plan(s) are linked to this DB")
                if obj.state != 'cancel':
                    raise UserError("Cannot Drop Database: Active plan(s) are linked to this DB")
                response = client.main_plan(obj.db_template, host_server, get_module_resource('odoo_saas_kit'))
                if not response['db_drop']:
                    raise UserError("ERROR: Couldn't Drop Database. Please Try Again Later.\n\nOperation\tStatus\n\nDrop database: \t{}\n".format(response['db_drop']))
                else:
                    obj.db_dropped=True
                    for plan in linked_plans:
                        plan.db_dropped=True
