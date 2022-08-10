import axios, { AxiosError } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import Pouet from '.';
import * as fs from 'fs';
import { Dumps } from './models';
import { DB_FILE_NAME, POUET_NET_JSON } from './constants';
import { copyGzFiles, createJson } from './data.spec';
import * as mockFs from 'mock-fs';
import * as sqlite3 from 'sqlite3';

describe('Pouet.getLatest', () => {
  let mockAxios: MockAdapter;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
    mockFs({
      testdata: copyGzFiles(),
    });
  });

  afterEach(() => {
    mockAxios.reset();
    mockFs.restore();
  });

  it(POUET_NET_JSON + ' 400', (done) => {
    mockAxios.onGet(POUET_NET_JSON).reply(400);
    Pouet.getLatest().subscribe({
      error: (err: AxiosError) => {
        expect(err.message).toEqual('Request failed with status code 400');
        expect(mockAxios.history.get[0].url).toEqual(POUET_NET_JSON);
        done();
      },
    });
  });

  it(POUET_NET_JSON + ' 200 null data', (done) => {
    mockAxios.onGet(POUET_NET_JSON).reply(200);
    Pouet.getLatest().subscribe({
      error: (err: any) => {
        expect(err).toBeDefined();
        expect(mockAxios.history.get[0].url).toEqual(POUET_NET_JSON);
        done();
      },
    });
  });

  it(POUET_NET_JSON + ' 200 with invalid data', (done) => {
    const JSON_DATA = createJson();
    mockAxios.onGet(POUET_NET_JSON).reply(200, JSON_DATA);
    Pouet.getLatest().subscribe({
      error: (err: AxiosError) => {
        expect(err.message).toEqual('Request failed with status code 404');
        expect(mockAxios.history.get[0].url).toEqual(POUET_NET_JSON);
        done();
      },
    });
  });

  it(POUET_NET_JSON + ' 200 with valid data', (done) => {
    const JSON_DATA = createJson();
    mockAxios.onGet(POUET_NET_JSON).reply(200, JSON_DATA);

    const mock = (url: string) => {
      mockAxios.onGet(url).reply(200, fs.readFileSync('./testdata/' + url));
    };

    mock(JSON_DATA.latest.prods.url);
    mock(JSON_DATA.latest.groups.url);
    mock(JSON_DATA.latest.parties.url);
    mock(JSON_DATA.latest.boards.url);

    Pouet.getLatest().subscribe({
      next: (dumps: Dumps) => {
        expect(dumps.prods.data.length).toEqual(1);
        expect(dumps.groups.data.length).toEqual(1);
        expect(dumps.parties.data.length).toEqual(1);
        expect(dumps.boards.data.length).toEqual(1);
        expect(Object.keys(dumps.platforms).length).toEqual(4);
        expect(Object.keys(dumps.users).length).toEqual(5);

        const prod = dumps.prods.data[0];
        expect(prod.name).toEqual('Astral Blur');
        expect(prod.placings[0].ranking).toEqual(3);
        expect(prod.placings[0].year).toEqual(1997);
        expect(prod.voteup).toEqual(81);
        expect(prod.votepig).toEqual(18);
        expect(prod.votedown).toEqual(5);
        expect(prod.voteavg).toEqual(0.73);
        expect(prod.party_place).toEqual(3);
        expect(prod.party_year).toEqual(1997);
        expect(prod.invitationyear).toEqual(2000);
        expect(prod.rank).toEqual(665);

        expect(dumps.users['1'].glops).toEqual(850);
        expect(dumps.users['1'].nickname).toEqual('analogue');

        expect(fs.existsSync('pouetdatadump-prods-99991231.json')).toBeTruthy();
        expect(
          fs.existsSync('pouetdatadump-boards-99991231.json'),
        ).toBeTruthy();
        expect(
          fs.existsSync('pouetdatadump-groups-99991231.json'),
        ).toBeTruthy();
        expect(
          fs.existsSync('pouetdatadump-parties-99991231.json'),
        ).toBeTruthy();

        done();
      },
      error: (err) => {
        throw new Error(err);
      },
    });
  });

  it(POUET_NET_JSON + ' 200 with valid data - undef gz data', (done) => {
    const JSON_DATA = createJson();
    mockAxios.onGet(POUET_NET_JSON).reply(200, JSON_DATA);

    const mock = (url: string) => {
      mockAxios.onGet(url).reply(200);
    };
    mock(JSON_DATA.latest.prods.url);
    mock(JSON_DATA.latest.groups.url);
    mock(JSON_DATA.latest.parties.url);
    mock(JSON_DATA.latest.boards.url);

    Pouet.getLatest().subscribe({
      error: (err) => {
        expect(err).toEqual('undefined gz data');
        done();
      },
    });
  });
});

describe('Pouet.genCSV', () => {
  it('genCSV', (done) => {
    if (fs.existsSync('out.csv')) {
      fs.unlinkSync('out.csv');
    }
    Pouet.genCSV([], 'out.csv', () => {});
    expect(fs.existsSync('out.csv')).toBeFalsy();
    Pouet.genCSV([{ id: 'id1', title: 'title1' }], 'out.csv', () => {
      expect(fs.existsSync('out.csv')).toBeTruthy();
      fs.unlinkSync('out.csv');
      done();
    });
  });
});

describe('Pouet.sqlQuery', () => {
  let mockAxios: MockAdapter;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
  });

  afterEach(() => {
    mockAxios.reset();
    mockFs.restore();
  });

  it('from file', (done) => {
    fs.copyFileSync('./testdata/pouet.db', 'pouet.db');

    const JSON_DATA = createJson();
    mockAxios.onGet(POUET_NET_JSON).reply(200, JSON_DATA);

    const mock = (url: string) => {
      mockAxios.onGet(url).reply(200, fs.readFileSync('./testdata/' + url));
    };

    mock(JSON_DATA.latest.prods.url);
    mock(JSON_DATA.latest.groups.url);
    mock(JSON_DATA.latest.parties.url);
    mock(JSON_DATA.latest.boards.url);

    const titles: string[] = [];
    Pouet.sqlQuery('SELECT * FROM platform;', DB_FILE_NAME, (title: string) => {
      titles.push(title);
    }).subscribe((result) => {
      expect(result.length).toEqual(4);
      expect(result.map((value) => value.name).sort()).toEqual([
        'BeOS',
        'Linux',
        'MS-Dos',
        'Windows',
      ]);
      expect(fs.existsSync('pouet.db')).toBeTruthy();
      expect(titles.sort()).toEqual([
        'Open pouet.db',
        'Start query',
        'Stop query',
      ]);
      done();
    });
  });

  it.skip('from file wrong version', (done) => {
    fs.copyFileSync('./testdata/pouet.db', 'pouet.db');
    const db = new sqlite3.Database(
      DB_FILE_NAME,
      sqlite3.OPEN_READWRITE,
      (err) => {
        db.serialize(() => {
          db.all('DROP TABLE IF EXISTS version;', (err, rows) => {
            db.close(() => {
              const JSON_DATA = createJson();
              mockAxios.onGet(POUET_NET_JSON).reply(200, JSON_DATA);

              const mock = (url: string) => {
                mockAxios
                  .onGet(url)
                  .reply(200, fs.readFileSync('./testdata/' + url));
              };

              mock(JSON_DATA.latest.prods.url);
              mock(JSON_DATA.latest.groups.url);
              mock(JSON_DATA.latest.parties.url);
              mock(JSON_DATA.latest.boards.url);

              const titles: string[] = [];
              Pouet.sqlQuery(
                'SELECT * FROM platform;',
                DB_FILE_NAME,
                (title: string) => {
                  titles.push(title);
                },
              ).subscribe((result) => {
                expect(result.length).toEqual(4);
                expect(result.map((value) => value.name).sort()).toEqual([
                  'BeOS',
                  'Linux',
                  'MS-Dos',
                  'Windows',
                ]);
                expect(fs.existsSync('pouet.db')).toBeTruthy();
                expect(titles.sort()).toEqual([
                  'Create database pouet.db',
                  'Create tables',
                  'Get latest',
                  'Insert tables',
                  'Start query',
                  'Start transaction',
                  'Stop query',
                  'Stop transaction',
                ]);
                done();
              });
            });
          });
        });
      },
    );
  });

  it('from web', (done) => {
    mockFs({
      testdata: copyGzFiles(),
      src: {
        'create.sql': mockFs.load('./src/create.sql'),
      },
    });
    const JSON_DATA = createJson();
    mockAxios.onGet(POUET_NET_JSON).reply(200, JSON_DATA);

    const mock = (url: string) => {
      mockAxios.onGet(url).reply(200, fs.readFileSync('./testdata/' + url));
    };

    mock(JSON_DATA.latest.prods.url);
    mock(JSON_DATA.latest.groups.url);
    mock(JSON_DATA.latest.parties.url);
    mock(JSON_DATA.latest.boards.url);

    const titles: string[] = [];

    Pouet.sqlQuery('SELECT * FROM platform;', ':memory:', (title: string) => {
      titles.push(title);
    }).subscribe((result) => {
      expect(result.length).toEqual(4);
      expect(result.map((value) => value.name).sort()).toEqual([
        'BeOS',
        'Linux',
        'MS-Dos',
        'Windows',
      ]);
      expect(titles.sort()).toEqual([
        'Create database :memory:',
        'Create tables',
        'Get latest',
        'Insert tables',
        'Start query',
        'Start transaction',
        'Stop query',
        'Stop transaction',
      ]);
      done();
    });
  });
});
