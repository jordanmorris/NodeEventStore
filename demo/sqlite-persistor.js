"use strict"

const nodeEventStore = require("cqrs-eventstore")
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const _ = require("underscore")
const util = require("util")
const uuid = require("uuid")

class SqlitePersistor extends nodeEventStore.PersistenceAdapter {
	constructor() {
		super()

		const file = "eventStore.db";
		const exists = fs.existsSync(file);
		this.db = new sqlite3.Database(file);

		this.db.serialize(() => {
			if (!exists) {
				this.db.run("CREATE TABLE Events (id TEXT, streamId TEXT, version INTEGER, timestamp TEXT, eventType TEXT, payload BLOB)");
				this.db.run("CREATE TABLE Snapshots (id TEXT, streamId TEXT, version INTEGER, timestamp TEXT, payload BLOB)");
			}
		});
	}

	save(events, snapshots) {
		const self = this;
		return new Promise((resolve, reject) => {
			self.db.serialize(() => {
				try {
					self.db.run("BEGIN TRANSACTION")
					_.each(events, (e) => {
						self.db.run("INSERT INTO Events VALUES (?, ?, ?, ?, ?, ?)", uuid.v4(), e.streamId, e.version, new Date(), e.eventType, e.payload)
					})
					_.each(snapshots, (e) => {
						self.db.run("INSERT INTO Snapshots VALUES (?, ?, ?, ?, ?)", uuid.v4(), e.streamId, e.version, new Date(), e.payload)
					})
					self.db.run("COMMIT TRANSACTION")
					resolve()
				} catch (err) {
					self.db.run("ROLLBACK TRANSACTION")
					reject(err)
				}
			})
		})
    }
    
    //return a promise
    readSnapshot(id) {
		return new Promise((resolve, reject) => {
			this.db.get("SELECT * FROM Snapshots WHERE streamId = ? ORDER BY version DESC LIMIT 1", [id], (err, row) => {
				if (err) return reject(err)
				resolve(row)
			});
		})
    }
    
    //return a promise
    readEvents(id, fromVersion) {
		return new Promise((resolve, reject) => {
			this.db.all("SELECT * FROM Events WHERE streamId = ? AND version > ? ORDER BY version", [id, fromVersion], (err, rows) => {
				if (err) return reject(err)
				resolve(rows)
			});
		})
    }
}

module.exports = new SqlitePersistor()