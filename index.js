import fs from 'fs';
import { find } from 'lodash';
import { promisify } from 'util';
import XmlReader from 'xml-reader';
import FuzzyMatching from 'fuzzy-matching';
import commandLineArgs from 'command-line-args';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const commandLineOptionsDefinition = [
  { name: 'm3u', alias: 'm', type: String, defaultValue: './tv_channels.m3u' },
  { name: 'epg', alias: 'e', type: String, defaultValue: './epg.xml' },
  { name: 'output', alias: 'o', type: String, defaultValue: './output.json' },
  { name: 'format', alias: 'f', type: String, defaultValue: 'json' },
  { name: 'input', alias: 'i', type: String, defaultValue: './channels.json' }
];

const commandLineOptions = commandLineArgs(commandLineOptionsDefinition);

let originalM3u = '';
const m3uChannels = [];
const epgChannels = [];

if (commandLineOptions.format === 'json') {
  readFile(commandLineOptions.m3u, 'utf8')
    .then(data => {
      originalM3u = data.replace(/\r\n/g, '\n');
      const lines = originalM3u.split('\n');

      let hadExtInf = false;
      let channelName = '';
      let group = '';
      lines.forEach(line => {
        let match = /^#EXTINF.*,(.*)$/.exec(line);
        if (match) {
          hadExtInf = true;
          channelName = match[1];
        } else {
          if (hadExtInf && !!channelName) {
            match = /<.+?>(.+?)<.+?>/.exec(channelName);
            if (match) {
              group = match[1].trim();
            }
            m3uChannels.push({ name: channelName, link: line, group: match ? '' : group, id: null });
          }
          hadExtInf = false;
          channelName = '';
        }
      });

      console.log('Channels from m3u: DONE');
      return readFile(commandLineOptions.epg, 'utf8');
    })
    .then(data => {
      const reader = XmlReader.create({ stream: true, parentNodes: false });

      reader.on('tag:channel', tag => {
        const id = tag.attributes.id;
        const displayNameTag = find(tag.children, ['name', 'display-name']);
        const displayName = find(displayNameTag.children, ['type', 'text']).value;
        epgChannels.push({ id, displayName });
      });

      const donePromise = new Promise(resolve => {
        reader.on('done', resolve);
      });

      reader.parse(data);

      return donePromise;
    })
    .then(() => {
      console.log('Channels from epg: DONE');
      const epgChannelNames = epgChannels.map(channel => channel.displayName);

      const fm = new FuzzyMatching(epgChannelNames);
      const matches = [];
      m3uChannels.forEach(channel => {
        const match = fm.get(channel.name);
        matches.push({...channel, distance: match.distance, ...find(epgChannels, ['displayName', match.value])});
      });

      return writeFile(commandLineOptions.output, JSON.stringify(matches));
    })
    .then(() => {
      console.log('Write matches: DONE');
    });
} else {
  const channels = require(commandLineOptions.input);
  console.log('Read input: DONE');
  const output = ['#EXTM3U'];
  channels.forEach(channel => {
    if (!channel.id) channel.id = '';
    output.push(`#EXTINF:-1 tvg-name="${channel.name}" tvg-id="${channel.id}" tvg-logo="" group-title="${channel.group}",${channel.name}`);
    output.push(channel.link);
  });
  writeFile(commandLineOptions.output, output.join('\n'))
    .then(() => { console.log('Write playlist: DONE'); });
}
