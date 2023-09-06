odoo.define('odoo_saas_kit.portal_operations', function(require) {
    
    var rpc = require('web.rpc');

    $('.instance_login').click(function(ev){
        var client_id = parseInt($('.instance_login').attr('client_id'));
        rpc.query({
            model: 'saas.client',
            method: 'read',
            args: [[client_id], ['client_url']],
        }).then(function(url){
            location.href = url[0]['client_url'];
        });
    });
});