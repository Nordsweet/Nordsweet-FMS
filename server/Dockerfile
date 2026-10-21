FROM python:3.13-alpine
WORKDIR /app
COPY flight_store.py .
ENV FLIGHT_DB_PATH=/data/flights.sqlite3
EXPOSE 8000
CMD ["python", "flight_store.py"]
