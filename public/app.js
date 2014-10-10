$(function () {
    var socket = io();

    var jobs = $('#jobs').find('tbody');

    socket.on('jobs', function (data) {
        jobs.empty();

        for (var i = 0; i < data.length; i++) {
            var job = data[i],
                row = $('<tr></tr>');
            row.append('<td>' + job.id + '</td>');
            row.append('<td>' + job.title + '</td>');
            row.append('<td>' + job.size + '</td>');
            row.append('<td>' + job.state + '</td>');
            var cancel = $('<td>' + (job.state != 'completed' ? '<a href="#" class="cancel">cancel</a>' : '') + '</td>');
            cancel.click({id: job.id}, function(ev) {
                socket.emit('cancel', {id : ev.data.id});
            });
            row.append(cancel);

            jobs.prepend(row)
        }
    });

   /* $( '#printForm' )
        .submit( function( e ) {
            $.ajax( {
                url: '/printMe',
                type: 'POST',
                data: new FormData( this ),
                processData: false,
                contentType: false
            } );
            e.preventDefault();
        } );*/

    Dropzone.options.printForm = {
        maxFilesize: 4, // MB
        acceptedFiles: "application/pdf"
    };
});
