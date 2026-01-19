FROM node:20-alpine

ADD https://netfree.link/dl/unix-ca2.sh /home/netfree-unix-ca.sh 
RUN cat  /home/netfree-unix-ca.sh | sh
ENV NODE_EXTRA_CA_CERTS=/etc/ca-bundle.crt
ENV REQUESTS_CA_BUNDLE=/etc/ca-bundle.crt
ENV SSL_CERT_FILE=/etc/ca-bundle.crt

# התקנת כלי מערכת (זה יורד פעם אחת ונשמר במטמון)
RUN apk add --no-cache \
    graphicsmagick \
    ghostscript \
    libc6-compat \
    python3 \
    make \
    g++ \
    ca-certificates \
    openssl

WORKDIR /app

# העתקת תעודת NetFree אם קיימת
#COPY netfree-ca.crt* /usr/local/share/ca-certificates/ 2>/dev/null || true
#RUN update-ca-certificates 2>/dev/null || true

# שלב חכם: מעתיקים רק את הקובץ שמגדיר את החבילות
COPY package.json package-lock.json* ./

# מתקינים חבילות. דוקר "זוכר" את השלב הזה.
# אם לא שינית את package.json, הוא ידלג על ההורדה הזו בפעם הבאה!
RUN npm install

# רק עכשיו מעתיקים את שאר הקוד
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]