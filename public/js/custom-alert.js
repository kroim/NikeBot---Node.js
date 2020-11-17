function customAlert(message, state) {
    let isSuccess = state || false;
    let html = "";
    if (isSuccess) {
        html += '<div class="alert alert-success alert-dismissible">\n' +
            '<button type="button" class="close" data-dismiss="alert" aria-hidden="true">×</button>\n' +
            '<h4><i class="icon fa fa-check"></i> Success !</h4>' + message + '</div>';
    } else {
        html += '<div class="alert alert-danger alert-dismissible">\n' +
            '<button type="button" class="close" data-dismiss="alert" aria-hidden="true">×</button>' +
            '<h4><i class="icon fa fa-ban"></i> Error !</h4>' + message + '</div>';
    }
    $('.custom-alert').html(html);
    setTimeout(function () {
        $('.custom-alert').html("");
    }, 3000);
}
