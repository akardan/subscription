# -*- coding: utf-8 -*-
{
    "name"  : "Software as a Services (BlueminkTech)",
    "summary" : """This Module can add ability Odoo to SAAS""",
    "category"  : "SAAS",
    "version" : "1.0.0",
    "author"  : "Chairoj L.",
    "website" : "Bluemink Tech",
    "description" : """Provide Odoo as a Service(Saas) on your serversS.""",
    "depends" :  [
      'sale_management',
      'portal',
      'base',
      'website_sale',
      'account',
    ],
    "data"  : [
        "security/saas_security.xml",
        "security/ir.model.access.csv",
        "views/saas_plans_view.xml",
        # "views/product_product.xml",
        "views/__menuitems__.xml",
    ],
  "application"          :  True,
  "installable"          :  True,
  "auto_install"         :  False,
}
