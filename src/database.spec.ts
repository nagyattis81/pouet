import {
  checkVersion,
  createDatabase,
  createTables,
  insertTables,
  runQueries,
} from './database';
import * as sqlite3 from 'sqlite3';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { POUET_NET_JSON } from './constants';
import * as fs from 'fs';
import { copyGzFiles, createJson } from './data.spec';
import * as mockFs from 'mock-fs';

describe('database.ts', () => {
  let db!: sqlite3.Database;
  let mockAxios: MockAdapter;
  beforeEach(() => {
    mockFs({
      testdata: copyGzFiles(),
      src: {
        'create.sql': mockFs.load('./src/create.sql'),
      },
    });

    mockAxios = new MockAdapter(axios);
    const JSON_DATA = createJson();
    mockAxios.onGet(POUET_NET_JSON).reply(200, JSON_DATA);

    const mock = (url: string) => {
      mockAxios.onGet(url).reply(200, fs.readFileSync('./testdata/' + url));
    };

    mock(JSON_DATA.latest.prods.url);
    mock(JSON_DATA.latest.groups.url);
    mock(JSON_DATA.latest.parties.url);
    mock(JSON_DATA.latest.boards.url);
  });

  afterEach(() => {
    mockAxios.reset();
    mockFs.restore();
  });

  it('createDatabase', (done) => {
    const titles: string[] = [];
    createDatabase(':memory:', (title: string) => {
      titles.push(title);
    }).subscribe((result) => {
      expect(result).toBeDefined();
      expect(titles.sort()).toEqual([
        'Create database :memory:',
        'Create tables',
        'Get latest',
        'Insert tables',
        'Start transaction',
        'Stop transaction',
      ]);
      result.serialize(() => {
        result.all('SELECT id,name from prod;', (_, rows) => {
          expect(rows).toEqual([
            {
              id: 1,
              name: 'Astral Blur',
            },
          ]);
          done();
        });
      });
    });
  });

  it('checkVersion', (done) => {
    createDatabase(':memory:').subscribe((result) => {
      expect(result).toBeDefined();
      checkVersion(':memory:').subscribe((result) => {
        expect(result).toBeFalsy();
        done();
      });
    });
  });

  it('checkVersion', (done) => {
    createDatabase(':memory:').subscribe((result) => {
      expect(result).toBeDefined();
      runQueries(result, 'CSELET * FORM prod').subscribe({
        error: (err) => {
          expect(err.errno).toEqual(1);
          expect(err.code).toEqual('SQLITE_ERROR');
          done();
        },
      });
    });
  });

  it('insertTables', (done) => {
    db = new sqlite3.Database(':memory:');
    createTables(db);

    const titles: string[] = [];
    insertTables(db, (title: string) => {
      titles.push(title);
    }).subscribe((result) => {
      expect(titles.sort()).toEqual([
        'Get latest',
        'Start transaction',
        'Stop transaction',
      ]);
      db.serialize(() => {
        db.all('SELECT id,name from prod;', (_, rows) => {
          expect(rows).toEqual([
            {
              id: 1,
              name: 'Astral Blur',
            },
          ]);
          expect(result).toBeNull();
          done();
        });
      });
    });
  });
});
