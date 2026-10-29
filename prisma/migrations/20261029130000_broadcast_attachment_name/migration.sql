-- Nome do arquivo anexado à campanha (imagem ou documento). Aditiva e nula: campanhas existentes não mudam.
ALTER TABLE "broadcast_campaigns" ADD COLUMN "attachment_name" TEXT;
