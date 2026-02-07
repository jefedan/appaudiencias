
export const downloadAsWord = (text: string, title: string, sourceInfo: string = '') => {
    const timestamp = new Date().toLocaleString('es-ES');
    
    // HTML wrapper to trick Word into opening it as a document
    const header = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>Transcripción de Audiencia</title>
            <style>
                body { font-family: 'Times New Roman', serif; line-height: 1.5; padding: 2cm; }
                h1 { text-align: center; color: #333; text-transform: uppercase; border-bottom: 2px solid #333; }
                .meta { margin-bottom: 30px; border-left: 4px solid #ccc; padding-left: 15px; color: #555; }
                .content { text-align: justify; white-space: pre-wrap; }
                .footer { margin-top: 50px; font-size: 10pt; text-align: center; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
            </style>
        </head>
        <body>
            <h1>Transcripción de Audiencia</h1>
            <div class="meta">
                <p><strong>Identificador:</strong> ${title}</p>
                <p><strong>Fecha de Generación:</strong> ${timestamp}</p>
                <p><strong>Origen del Audio:</strong> ${sourceInfo}</p>
            </div>
            <div class="content">
                ${text.replace(/\n/g, '<br>')}
            </div>
            <div class="footer">
                Documento generado automáticamente por Asistente de Audiencias IA
            </div>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff', header], {
        type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
    link.href = url;
    link.download = `transcripcion_${safeTitle}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
