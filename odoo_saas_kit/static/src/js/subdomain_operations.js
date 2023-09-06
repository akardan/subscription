odoo.define('odoo_saas_kit.subdomain_operations', function(require) {

    var rpc = require('web.rpc');
    var ajax = require('web.ajax');

    // $('.revoke_domain').click(function(ev){
    //     var answer = confirm("Are You Sure You want to Revoke this domain..?");
    //     if (answer == true){
    //         var domain_id = parseInt($(ev.currentTarget).attr('domain_id'));
    //         rpc.query({
    //             model: 'custom.domain',
    //             method: 'revoke_subdomain_call',
    //             args: [domain_id],
    //         }).then(function(url){
    //             location.href = url
    //         });
    //     }
    // });

    $('#sub_domain_span_1, #add_domain_icon_div').click(function(ev){
        $("#add_custom_domain").modal("toggle");
    });

    $('#btn_add_domain').click(function(ev){
        var contract_id = $('#contract_id').attr('value');
        var domain_name = $('#add_subdomain_name').val();
        // rpc.query({
        //     model: 'custom.domain',
        //     method: 'add_subdomain_call',
        //     args: [contract_id, domain_name],
        // }).then(function(response){
        //     if (response.status){
        //         $("#add_custom_domain").modal("hide");
        //         location.href = response.msg;
        //     }else{
        //         $('#domain_taken_warning').text(response.msg);
        //         $('#domain_taken_warning').show();
        //     }
        // });

        ajax.jsonRpc("/my/saas/contract/add/domain", 'call', {
            'contract_id':contract_id, 'domain_name':domain_name,
        }).then(function(vals){
            // alert("after ajax add_domain_submit");
            console.log(vals);
            if (vals['response']['status']){
                alert("in IF");
                alert(vals['response']['status']);
                $("#add_custom_domain").modal("hide");
                console.log(vals['data']);
                $('#domain_tbody').replaceWith(vals['data']);

                // location.href = response.msg;
            }else{
                alert("in ELSE");
                alert(vals['response']['status'], vals['response']['msg']);

                $('#domain_taken_warning').text(vals['response']['msg']);
                $('#domain_taken_warning').show();
            }
        });
    });
});
