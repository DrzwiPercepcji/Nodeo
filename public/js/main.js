$(document).ready(function () {
    let progress = $('#progress');

    function setProgress(value) {
        progress.attr('value', value);
        progress.text(value + '%');
    }

    $('.navbar-burger').on('click', function () {
        $(".navbar-burger").toggleClass('is-active');
        $(".navbar-menu").toggleClass('is-active');
    });

    $('#file-input').on('change', function () {
        let name = this.files[0].name;
        $('#file-name').text(name);
    });

    $('#upload-form').ajaxForm(
        {
            beforeSend: function () {
                setProgress(0);
            },
            uploadProgress: function (event, position, total, complete) {
                setProgress(complete);
            },
            complete: function (xhr) {
                setProgress(100);
            }
        });
});