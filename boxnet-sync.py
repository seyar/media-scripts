# /usr/bin/python
import mimetypes
import os
import urllib2
import json
import sys
import ConfigParser
import itertools
import mimetools
import hashlib
from xml.dom.minidom import *
from optparse import OptionParser


""" syncronize photos local comp with box.net file storage
    Usage: sync.py /home/seyar/Pictures -v --del=1 --file-type=txt
    command path
    -v  verbose
    --del   will delete files on remote server
    --file-type filter upload by file type

"""
class Syncronizer:
    API_KEY = 'buesi7r3yqbfv58v9n1hdy404ftf7u62'
    AUTH_TOKEN = 'df2f77pdoz0y5cretazzbu7fexncb06p'

    START_FOLDER = 0
    ERROR_CODE = 1
    ERROR_CODE_WRONG_XML = 300
    ERROR_CODE_WRONG_TICKET = 301
    ERROR_CODE_WRONG_TOKEN = 302
    ERROR_CODE_UNKNOWN = 400

    ERROR_CODE_NOAPIKEY = 401
    ERROR_DESC_NOAPIKEY = 'Need enter the API_KEY'

    ERROR_CODE_NOPATH = 402
    ERROR_DESC_NOPATH = 'No path specified'

    ERROR_DESCRIPTION = ''

    """ file name which save remote listing files and folders """
    listingFilename = 'remoteList.log'

    """ sync iteration for debug """
    iter = 0

    def __init__(self):
        # get options
        parser = OptionParser()

        """ sync with remote listing. save it to file """
        parser.add_option("-s", "--sync", dest="sync",
            help="If option enabled remote listing will read again", metavar="SYNC")

        """ delete remote files """
        parser.add_option("-d", "--del", dest="deletesync",
            help="Delete remote files, which deleted in local listitng", metavar="DEL")

        parser.add_option("-v", "", dest="verbose", action="store_true",
            help="show additional info", metavar="VERBOSE")

        parser.add_option("", "--file-type", dest="filetype",
            help="Upload file type filter", metavar="FILETYPE")

        (self.options, args) = parser.parse_args()
        """ root folder destination """
        try:
            self.options.path = os.path.normpath(args[0])
        except Exception,e:
            e.code = self.ERROR_CODE_NOPATH
            e.message = e.message + self.ERROR_DESC_NOPATH
            print 'Error Detected. Code:%d. Desc:%s' % (e.code, e.message)
            return

        """ root folder name, like 'photos' """
        self.options.rootfoldername = os.path.basename(self.options.path)

        if self.API_KEY == "":
            raise Exception(self.ERROR_CODE_NOAPIKEY, self.ERROR_DESC_NOAPIKEY)

        if self.options.filetype != "" and self.options.filetype[1] != '.':
            self.options.filetype = '.'+self.options.filetype

        try:
            self.perform()

        except Exception,e:
            print 'Error Detected. Code:%d. Desc:%s' % (self.ERROR_CODE, e.message)

        return

    def perform(self):
        try:
            locallist = self.getLocalFolderListing()
            if len(locallist['files']) == 0 and len(locallist['folders']) == 0:
                if bool(self.options.verbose) == True:
                    print "No files in folder"
                return

            """ sync listings only then option enabled """
            if self.options.sync:
                remotelist = self.getRemoteListing()
                self.__saveRemoteListingToFile(remotelist)
                pass

            remotelist = self.readRemoteFileListFromFile()

            """ compare folder and files. get list for upload """
            (locallist,removeList) = self.compareListings(locallist, remotelist)

            if bool(self.options.deletesync) == True:
                """ remove files and folders """
                self.deleteItems(removeList)

            """ create remote folders """
            self.batchCreateRemoteFolders(locallist, remotelist)


#            self.createRemoteFolder('newfold')
            self.getUploadFileList(locallist, remotelist)

        except Exception,e:
            print 'Error Detected. Code:%d. Desc:%s' % (self.ERROR_CODE, e.message)

        return

    def getTicket(self):
        """ func get ticket for user """
        url = 'https://www.box.com/api/1.0/rest?action=get_ticket&api_key='+self.API_KEY
        xml = self.__getPageContents(url)
        try:
            ticket = self.__parseXml(xml)
        except Exception,e:
            self.ERROR_CODE = self.ERROR_CODE_WRONG_TICKET
            self.ERROR_DESCRIPTION = 'Cannot read xml content for token. '+e.message
            raise Exception(e.message)

        return ticket['ticket']

    def getToken(self,ticket):
        """ func get oauth token """
        url = 'https://www.box.com/api/1.0/auth/ticket=%s' % ticket
#        url = 'https://www.box.com/api/1.0/rest?action=get_auth_token&api_key=%s&ticket=%s' % (self.API_KEY, ticket)
        xml = self.__getPageContents(url)

        try:
            token = self.__parseXml(xml)
        except Exception,e:
            self.ERROR_CODE = self.ERROR_CODE_WRONG_TOKEN
            self.ERROR_DESCRIPTION = 'Cannot read xml: "%s",ticket:%s, ticket content for token. %s' % (xml, ticket, e.message)
            raise Exception(e.message)

        return token

    def getRemoteFolderEntries(self, folder=START_FOLDER):
        url = 'https://api.box.com/2.0/folders/%s/items' % folder
        params = {'Authorization':'BoxAuth api_key=%s&auth_token=%s' % (self.API_KEY, self.AUTH_TOKEN) }

        result = {}
        content = self.__getPageContents(url, params)
        result = self.__parseJson(content)
        return result['entries']

    def __parseJson(self, jsonString):
        try:
            result = json.loads(jsonString)
        except Exception,e:
            self.ERROR_CODE = getattr(e,'code',self.ERROR_CODE_UNKNOWN)
            self.ERROR_DESCRIPTION = 'Cannot parse json. ' + e.message + getattr(e,'msg','')
            raise Exception(getattr(e,'code',''),getattr(e,'message','')+getattr(e,'msg',''))
        return result

    def __getPageContents(self, url, headers={}, postData=None, files={}, method=None):
        try:
            if files is not None and len(files) > 0:
                form = MultiPartForm()
                req = urllib2.Request(url)
                if headers is not None and len(headers) > 0:
                    for header in headers:
                        req.add_header(header, headers[header])


                if postData is not None and len(postData) > 0:
                    for d in postData:
                        form.add_field(d, str(postData[d]))

                for file in files:
                    filename=os.path.basename(file)
#                    form.add_field('firstname', 'Doug')

                    # Add a fake file
                    form.add_file(filename, filename,
                        fileHandle=open(file))

                    # Build the request
#                    request.add_header('User-agent', 'PyMOTW (http://www.doughellmann.com/PyMOTW/)')
                    body = str(form)
                    req.add_header('Content-type', form.get_content_type())
                    req.add_header('Content-length', len(body))
                    req.add_data(body)
            else:
                req = urllib2.Request(url,postData,headers)

            if method != None:
                req.get_method = lambda: method
            result = urllib2.urlopen(req)
            result = result.read()
        except Exception, e:
            self.ERROR_CODE = getattr(e,'code',self.ERROR_CODE_UNKNOWN)
            self.ERROR_DESCRIPTION = 'Cannot read content. ' + e.message + getattr(e,'msg','')
            raise Exception(self.ERROR_DESCRIPTION)
        else:
            return result

    def __parseXml(self,xmlString):
        """
        Print out all titles found in xml
        """
        doc = xml.dom.minidom.parseString(xmlString)
#        node = doc.documentElement
        response = doc.getElementsByTagName("response")[0]

        result = {}
        for node in response.childNodes:
            children = node.childNodes
            for childNode in children:
                if node.nodeType == node.ELEMENT_NODE:
                    try:
                        result[node.tagName] = childNode.data
                    except AttributeError, e:
                        self.ERROR_CODE = ERROR_CODE_WRONG_XML
                        self.ERROR_DESCRIPTION = 'Cannot read xml content. '+e.message
                        raise Exception(e.message)

        return result

    def getLocalFolderListing(self,root=None):
        """
        get local folder listing
        """
        root = 1 and root or self.options.path
        fileList = []
        forders = []

        for root, dirnames, files in os.walk(self.options.path):
            for subdirname in dirnames:
                url = os.path.join(root, subdirname)
                urlparts = url.split('/')
                urlparts = urlparts[urlparts.index(self.options.rootfoldername):]
                forders.append('/'.join(urlparts))
            for file in files:
                url = os.path.join(root,file)
                urlparts = url.split('/')
                urlparts = urlparts[urlparts.index(self.options.rootfoldername):]
                fileList.append('/'.join(urlparts))

        return {"folders":forders, "files":fileList}

    def getRemoteListing(self):
        """ get remote listing send requests to API box.net """
        if self.options.verbose == True:
            print "Get remote file listing. Its may take some minutes. You can drink cup of tea"

        rootContents = self.getRemoteFolderEntries()
        folderID = self.START_FOLDER

        for item in rootContents:
            if item['name'] == self.options.rootfoldername:
                folderID = item['id']

        if folderID == self.START_FOLDER:
            # create folder if not exists
            folderID = self.createRemoteFolder(self.options.rootfoldername)
            if self.options.verbose == True:
                print "Folder not exists. will create it"

        folderContents = self.getRemoteFolderEntries(folderID)
        return self.getRemoteListingRecursive(self.options.rootfoldername,folderContents, {folderID:self.options.rootfoldername})

    def getRemoteListingRecursive(self,currentPath,folderContents, folderListing={}, fileListing={}):
        print "="
#        print "%s =" % self.iter
        self.iter = self.iter+1

#        if self.iter > 4:
#            return {'folders':folderListing,'files':fileListing}

        for item in folderContents:
            itemName = "%s/%s" % (currentPath,item['name'])

            if item['type'] == 'folder':
                folderListing[item['id']] = itemName
                self.getRemoteListingRecursive(itemName,self.getRemoteFolderEntries(item['id']), folderListing, fileListing)
            elif item['type'] == 'file':
                fileListing[item['id']] = itemName
        return {'folders':folderListing,'files':fileListing}

    def __saveRemoteListingToFile(self, data):
        config = ConfigParser.RawConfigParser()
        try:
            type = 'folders'
            config.add_section(type)
            for i in data['folders']:
                config.set(type, i, data['folders'][i])

            type = 'files'
            config.add_section(type)
            for i in data['files']:
                # if filter by file type
                if self.options.filetype != "" and str(self.options.filetype).lower() == str(os.path.splitext(data['files'][i])[1]).lower():
                    config.set(type, i, data['files'][i])


            with open("%s/%s" % (self.options.path,self.listingFilename), 'w') as configfile:
                config.write(configfile)

            if self.options.verbose == True:
                print "Local listing saved"

        except IOError, e:
            self.ERROR_CODE = getattr(e,'code',self.ERROR_CODE_UNKNOWN)
            self.ERROR_DESCRIPTION = 'Couldn\'t save to file.' + e.message + getattr(e,'msg','')
        pass

    def __saveRowInListingFile(self, data, section='files'):
        """ saves one row in local listing file """
        current = self.readRemoteFileListFromFile()
        for i in data:
            current[section].append( (int(i), data[i]) )
        """ transform to file save structure """
        transform = {}
        for i in current:
            transform[i] = {}
            for item in current[i]:
                key = str(item[0])
                transform[i][key] = item[1]

        self.__saveRemoteListingToFile(transform)
        pass

    def __deleteRowInListingFile(self, itemname):
        """ delete one row in local listing file """
        current = self.readRemoteFileListFromFile()

        """ transform to file save structure """
        transform = {}
        for i in current:
            transform[i] = {}
            for item in current[i]:
                if item[1] != itemname:
                    key = str(item[0])
                    transform[i][key] = item[1]

        self.__saveRemoteListingToFile(transform)
        pass

    def readRemoteFileListFromFile(self):
        filename = "%s/%s" % (self.options.path,self.listingFilename)
        # save listing to file if it not exists
        if os.path.exists(filename) == False:
            if bool(self.options.verbose) == True:
                print "Listing File doesnt exist, will create it"
            remotelist = self.getRemoteListing()
            self.__saveRemoteListingToFile(remotelist)

        config = ConfigParser.RawConfigParser()
        try:
            config.read(filename)
        except Exception,e:
            self.ERROR_CODE = getattr(e,'code',self.ERROR_CODE_UNKNOWN)
            self.ERROR_DESCRIPTION = 'Couldn\'t read from file.' + e.message + getattr(e,'msg','')


        return {'folders':config.items('folders'),'files':config.items('files')}

    def compareListings(self, locallist, remotelist):
        """ compare local and remote listings for define for upload files, and files need to be deleted
        """
        removeList = {'folders':{},'files':{}}
        for (id,name) in remotelist['folders']:
            tmp = name in locallist['folders']
            if tmp == False and name != self.options.rootfoldername:
                removeList['folders'][id] = name
                # file exists in remote listing but not in local. will remove it in remote

            if name in locallist['folders']:
                # its similar folders will upload it
                # file exists in local listing and remote. remove it from local
                locallist['folders'].remove(name)

        del tmp
        for (id,name) in remotelist['files']:
            tmp = name in locallist['files']
            if tmp == False:
                # file exists in remote listing but not in local. will remove it
                removeList['files'][id] = name

            if name in locallist['files']:
                # its similar
                # file exists in local listing and remote. remove it from local
                locallist['files'].remove(name)

        return (locallist,removeList)

    def createRemoteFolder(self, name, folder=START_FOLDER, parentFolderName=""):
        url = "https://api.box.com/2.0/folders/%s" % folder
        params = {'Authorization':'BoxAuth api_key=%s&auth_token=%s' % (self.API_KEY, self.AUTH_TOKEN) }
        data = '{"name": "%s"}' % name

        if bool(self.options.verbose) == True:
            print "Created new folder '%s'" % name
        result = {}
        content = self.__getPageContents(url, params,data)
        result = self.__parseJson(content)
        self.__saveRowInListingFile({result['id']: "%s/%s" % (parentFolderName,name)}, 'folders')
        return result['id']

    def batchCreateRemoteFolders(self, locallist, remotelist):
        for item in locallist['folders']:
            # find parent remote folder ID
            path = item.split('/')
            parentFolderName = '/'.join(path[0:-1])
            for (id, remoteFolder) in remotelist['folders']:
                if remoteFolder == parentFolderName:
                    parentFolderID = id
                    remoteFolderName = os.path.basename(item)
                    break

            try:
                newRemoteFolderID = self.createRemoteFolder(remoteFolderName, parentFolderID, parentFolderName)
                config = ConfigParser.RawConfigParser()
                """ save listing info in the local file """
    #        try:
    #            type = 'folders'
    #            config.add_section(type)
    #            for (i,name) in remotelist['folders']:
    #                config.set(type, i, name)
    #
    #            config.set(type, newRemoteFolderID, remoteFolderName)
    #
    #            with open("%s/%s" % (self.options.path,self.listingFilename), 'w') as configfile:
    #                config.write(configfile)
    #        except Exception,e:
    #            self.ERROR_CODE = getattr(e,'code',self.ERROR_CODE_UNKNOWN)
    #            self.ERROR_DESCRIPTION = 'Couldn\'t write to file.' + e.message + getattr(e,'msg','')

            except Exception,e:
                self.ERROR_CODE = getattr(e,'code',self.ERROR_CODE_UNKNOWN)
                self.ERROR_DESCRIPTION = 'Couldn\'t read from file.' + e.message + getattr(e,'msg','')
        pass

    def getUploadFileList(self, locallist, remotelist):
        for item in locallist['files']:
            path = item.split('/')
            fileFolderName = '/'.join(path[0:-1])
            # get folder name
            for (id,name) in remotelist['folders']:
                if name == fileFolderName:
                    fileFolderID = id
                    self.__uploadFile(fileFolderID, item)
                    break
        pass

    def __uploadFile(self, fileFolderID, item):
        """ upload file to remote file storage
        """
        # dont upload db file
        if os.path.basename(item) == self.listingFilename:
            return

        item = item.split('/')
        item = "%s/%s" % (self.options.path, '/'.join(item[1:]))

        # if filter by file type
        ppd = str(self.options.filetype).lower()
        aa = str(os.path.splitext(item)[1]).lower()
        if self.options.filetype != "" and str(self.options.filetype).lower() != str(os.path.splitext(item)[1]).lower():
            return

        file = open(item)
        url = "https://api.box.com/2.0/files/data"
        params = {'Authorization':'BoxAuth api_key=%s&auth_token=%s' % (self.API_KEY, self.AUTH_TOKEN) }
        data = {"folder_id":fileFolderID, 'item':file}
        content = self.__getPageContents(url,params,{"folder_id":fileFolderID}, {item:file})
        result = self.__parseJson(content)
        if bool(self.options.verbose) == True:
            print "%s uploaded\n" % file.name

        # rebuild path for local file start from root folder
        urlparts = item.split('/')
        urlparts = urlparts[urlparts.index(self.options.rootfoldername):]

        #find file ID
        fileID = 0
        for i in result['entries']:
            if i['name'] == os.path.basename(file.name):
                fileID = i['id']
                break

        self.__saveRowInListingFile({fileID: '/'.join(urlparts)})
        return result

    def deleteItems(self, items):

        for id in items['files']:
            self.deleteFile(id,items['files'][id])

        for id in items['folders']:
            self.deleteFolder(id,items['folders'][id])

    def deleteFile(self, fileID, fake_filename):
        filename = fake_filename.split('/')
        filename = "%s/%s" % (self.options.path, '/'.join(filename[1:]))

        if os.path.exists(filename) == False:
            return True

        url = "https://api.box.com/2.0/files/%s" % fileID
        params = {'Authorization':'BoxAuth api_key=%s&auth_token=%s' % (self.API_KEY, self.AUTH_TOKEN) }
        params['If-Match'] = self.__hashfile(filename)
        content = self.__getPageContents(url,params, method='DELETE')
        result = self.__parseJson(content)
        if bool(self.options.verbose) == True:
            print "%s file deleted\n" % filename

        self.__deleteRowInListingFile(fake_filename)

        return True

    def deleteFolder(self, folderID, foldername):

        url = "https://api.box.com/2.0/folders/%s?force=true" % folderID
        params = {'Authorization':'BoxAuth api_key=%s&auth_token=%s' % (self.API_KEY, self.AUTH_TOKEN) }
        try:
            content = self.__getPageContents(url,params, method='DELETE')
            result = self.__parseJson(content)
        except Exception:
            pass

        if bool(self.options.verbose) == True:
            print "%s folder deleted\n" % folderID

        self.__deleteRowInListingFile(foldername)
        return True

    def __hashfile(self, filepath):
        sha1 = hashlib.sha1()
        f = open(filepath, 'rb')
        try:
            sha1.update(f.read())
        finally:
            f.close()
        return sha1.hexdigest()




class MultiPartForm(object):
    """Accumulate the data to be used when posting a form."""

    def __init__(self):
        self.form_fields = []
        self.files = []
        self.boundary = mimetools.choose_boundary()
        return

    def get_content_type(self):
        return 'multipart/form-data; boundary=%s' % self.boundary

    def add_field(self, name, value):
        """Add a simple field to the form data."""
        self.form_fields.append((name, value))
        return

    def add_file(self, fieldname, filename, fileHandle, mimetype=None):
        """Add a file to be uploaded."""
        body = fileHandle.read()
        if mimetype is None:
            mimetype = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        self.files.append((fieldname, filename, mimetype, body))
        return

    def __str__(self):
        """Return a string representing the form data, including attached files."""
        # Build a list of lists, each containing "lines" of the
        # request.  Each part is separated by a boundary string.
        # Once the list is built, return a string where each
        # line is separated by '\r\n'.
        parts = []
        part_boundary = '--' + self.boundary

        # Add the form fields
        parts.extend(
            [ part_boundary,
              'Content-Disposition: form-data; name="%s"' % name,
              '',
              value,
              ]
                for name, value in self.form_fields
        )

        # Add the files to upload
        parts.extend(
            [ part_boundary,
              'Content-Disposition: file; name="%s"; filename="%s"' %\
              (field_name, filename),
              'Content-Type: %s' % content_type,
              '',
              body,
              ]
                for field_name, filename, content_type, body in self.files
        )

        # Flatten the list and add closing boundary marker,
        # then return CR+LF separated data
        flattened = list(itertools.chain(*parts))
        flattened.append('--' + self.boundary + '--')
        flattened.append('')
        return '\r\n'.join(flattened)


if __name__ == '__main__':
    Syncronizer()


